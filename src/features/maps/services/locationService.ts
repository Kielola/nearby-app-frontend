/**
 * Location + address resolution.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The previous implementation did this:
 *
 *   1. Take whatever `navigator.geolocation` handed back — with no check
 *      on `coords.accuracy`.
 *   2. Reverse-geocode it with Nominatim.
 *   3. If that failed for ANY reason (offline, rate limit, timeout, no
 *      road at that point), fall back to a HARDCODED street:
 *        finalRoad = 'Gbongan Road'  /  closestPreset.streets[0]
 *   4. Write the result to state, localStorage and the database.
 *
 * Three separate bugs fell out of that:
 *
 *   • A cold-start GPS fix in Nigeria is routinely 500 m – 3 km off while
 *     the device is still doing network-based positioning. Geocoding that
 *     point returns a street you are not on.
 *   • When the lookup failed, the user was given a real-sounding but
 *     entirely invented address — a location up to 250 km away — and it
 *     was persisted.
 *   • Because the invented value was saved, it stuck across reloads.
 *
 * So the rules this module enforces:
 *
 *   • Reject fixes too imprecise to name a street, rather than geocoding
 *     them anyway.
 *   • NEVER invent a street name.
 *   • NEVER show the user a raw coordinate pair. See below.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE LABEL IS NEVER "6.5833, 3.3667" ANY MORE
 * ─────────────────────────────────────────────────────────────────────────
 * When every geocoder failed, this module used to fall back to the decimal
 * coordinate pair as the display label. Users reported that address "looking
 * like an IP address" — and they were reading `6.5833, 3.3667`, which is
 * indistinguishable from one at a glance. It was also *wrong* in the way that
 * matters: it reads like a precise address while conveying nothing a person
 * can act on.
 *
 * A coordinate pair is now never a label. If nothing can be resolved the user
 * is told the truth — "Location unavailable" — and nothing is written to their
 * profile.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THERE ARE NOW THREE GEOCODERS
 * ─────────────────────────────────────────────────────────────────────────
 * Nominatim alone was also the direct cause of far more coordinate-pair
 * labels than it should have produced, because its field names for Nigerian
 * places do not match the fields this module read. Measured against live data:
 *
 *   (7.3775, 3.9470) — Ibadan
 *     Nominatim → { county: "Ona Ara", state: "Oyo" }        ← no road, no town
 *     The old chain read only suburb/neighbourhood/city_district/town/city/
 *       village, found nothing, and fell all the way through to coordinates.
 *     "Oyo" was sitting in the response the whole time, unread.
 *
 * So: the field chain is widened (county, district, municipality, hamlet,
 * borough, state_district), and two more free geocoders are tried before
 * giving up. Each returns a different shape and covers places the others miss:
 *
 *   1. Nominatim (OpenStreetMap)  — street level, 1 req/sec, needs the throttle
 *   2. Photon (komoot)            — street level, reads `street`/`city`/`county`
 *   3. BigDataCloud client API    — coarse, but reliable when the other two
 *                                   return nothing (no key, no signup)
 *
 * All three are free and keyless. The order matters: street-level first, so a
 * precise answer is never replaced by a coarse one.
 */

export interface ResolvedAddress {
  /** Street name, or null when we genuinely could not determine one. */
  road: string | null;
  /** Area / district / city. */
  town: string | null;
  /** State, e.g. "Lagos". */
  state: string | null;
  /** Country, e.g. "Nigeria". */
  country: string | null;
  /** Full label for display. Always honest about its precision. Never a
   *  raw coordinate pair. */
  label: string;
  /** How the label was derived — lets the UI avoid over-claiming. */
  precision: 'street' | 'area' | 'approximate';
  accuracyMeters: number | null;
  /** Which geocoder produced this, for debugging. */
  source?: 'nominatim' | 'photon' | 'bigdatacloud' | 'none';
}

/**
 * Above this, the fix is too coarse to attach a street name to. A 150 m
 * reading can easily be one or two streets out, and naming the wrong
 * street to a user who is arranging to meet a stranger is worse than
 * naming none. Deliberately conservative.
 */
export const MAX_ACCURACY_FOR_STREET_METERS = 150;

/** Nominatim asks for max 1 request/second. We stay well under, and apply the
 *  same politeness to every geocoder — the cache means it costs nothing. */
const MIN_MS_BETWEEN_GEOCODES = 1100;

/** Remote lookups must never hang the location pipeline. */
const GEOCODE_TIMEOUT_MS = 8000;

/** Cache TTL. Coordinates barely change, so this is mainly a spam guard. */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  value: ResolvedAddress | null;
}

const cache = new Map<string, CacheEntry>();
let lastRequestAt = 0;
let inFlight: Promise<ResolvedAddress | null> | null = null;
let inFlightKey = '';

/** Rounds to ~11 m so tiny GPS jitter doesn't bust the cache. */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Enforces the global gap so no geocoder is ever hit faster than ~1 req/sec. */
async function politeDelay() {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_MS_BETWEEN_GEOCODES) {
    await sleep(MIN_MS_BETWEEN_GEOCODES - sinceLast);
  }
  lastRequestAt = Date.now();
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The first non-empty string from a list of candidate fields.
 *
 * Exported for tests: the whole Ibadan bug was this function being handed too
 * short a list, so the list itself is what must be guarded, not the caller.
 */
export function firstOf(
  source: Record<string, unknown> | undefined | null,
  keys: string[],
): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** Street-level fields, in descending order of specificity. */
const ROAD_KEYS = ['road', 'pedestrian', 'footway', 'path', 'street', 'highway', 'residential'];

/** Place-level fields. The Nigerian-relevant additions are county, district,
 *  municipality, state_district and hamlet — see the header comment. */
const TOWN_KEYS = [
  'suburb',
  'neighbourhood',
  'city_district',
  'district',
  'borough',
  'municipality',
  'town',
  'city',
  'village',
  'hamlet',
  'county',
  'state_district',
  'locality',
];

const STATE_KEYS = ['state', 'region', 'province', 'principalSubdivision', 'county'];
const COUNTRY_KEYS = ['country', 'countryName'];

export interface Parts {
  road: string | null;
  town: string | null;
  state: string | null;
  country: string | null;
}

/** Geocoder 1 — Nominatim / OpenStreetMap. */
async function fromNominatim(lat: number, lng: number): Promise<Parts | null> {
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    { 'Accept-Language': 'en' },
  );
  const addr = data?.address;
  if (!addr) return null;
  return {
    road: firstOf(addr, ROAD_KEYS),
    town: firstOf(addr, TOWN_KEYS),
    state: firstOf(addr, STATE_KEYS),
    country: firstOf(addr, COUNTRY_KEYS),
  };
}

/** Geocoder 2 — Photon (komoot). Different coverage, same street granularity. */
async function fromPhoton(lat: number, lng: number): Promise<Parts | null> {
  const data = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`);
  const props = data?.features?.[0]?.properties;
  if (!props) return null;
  return {
    road: firstOf(props, ROAD_KEYS),
    town: firstOf(props, TOWN_KEYS),
    state: firstOf(props, STATE_KEYS),
    country: firstOf(props, COUNTRY_KEYS),
  };
}

/** Geocoder 3 — BigDataCloud's keyless client endpoint. Coarse (city /
 *  locality / subdivision) but dependable when the other two come back empty. */
async function fromBigDataCloud(lat: number, lng: number): Promise<Parts | null> {
  const data = await fetchJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
  );
  if (!data) return null;
  const town =
    data.city || data.locality || data.localityInfo?.administrative?.[3]?.name || null;
  const state = data.principalSubdivision || null;
  const country = data.countryName || null;
  if (!town && !state) return null;
  return { road: null, town, state, country };
}

/** Merge: first non-null wins, so a later geocoder can fill a gap without
 *  overwriting something better. */
function mergeParts(primary: Parts | null, secondary: Parts | null): Parts | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    road: primary.road ?? secondary.road,
    town: primary.town ?? secondary.town,
    state: primary.state ?? secondary.state,
    country: primary.country ?? secondary.country,
  };
}

function hasAnything(parts: Parts | null): boolean {
  return Boolean(parts && (parts.road || parts.town || parts.state));
}

/**
 * Turn resolved geocoder fields into the final address object.
 *
 * Extracted and exported as a **pure function** on purpose: the bug this
 * replaces lived entirely in the branch below, and a rule that cannot be called
 * from a test cannot be regression-guarded. There is a unit test for the exact
 * Ibadan response that used to produce a coordinate pair as an "address".
 *
 * The branch order is the whole fix:
 *   1. A street — but only when the GPS fix was precise enough for the claim.
 *   2. A town/area/district.
 *   3. A state on its own. THIS is the case that used to fall through to raw
 *      coordinates even though the state was present in the response.
 *   4. A country on its own.
 *   5. "Location unavailable".
 *
 * A raw coordinate pair is never produced here. Not in any branch.
 */
export function buildResolvedAddress(
  parts: Parts,
  accuracyMeters: number | null,
  source: ResolvedAddress['source'] = 'nominatim',
): ResolvedAddress {
  const { road, town, state, country } = parts;

  const tooCoarse =
    accuracyMeters !== null && accuracyMeters > MAX_ACCURACY_FOR_STREET_METERS;

  // Only claim a street if we actually got one AND the fix was precise enough
  // for that claim to mean something.
  const useStreet = Boolean(road) && !tooCoarse;

  let label: string;
  let precision: ResolvedAddress['precision'];

  if (useStreet) {
    label = [road, town, state].filter(Boolean).join(', ');
    precision = 'street';
  } else if (town) {
    label = [town, state].filter(Boolean).join(', ');
    precision = 'area';
  } else if (state) {
    label = [state, country].filter(Boolean).join(', ');
    precision = 'area';
  } else if (country) {
    label = country;
    precision = 'approximate';
  } else {
    label = 'Location unavailable';
    precision = 'approximate';
  }

  return {
    road: useStreet ? road : null,
    town,
    state,
    country,
    label,
    precision,
    accuracyMeters,
    source,
  };
}

/**
 * Reverse-geocode one coordinate pair.
 * Returns null when no address could be resolved — callers must handle
 * that honestly rather than substituting a fake street or a coordinate pair.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  accuracyMeters: number | null,
): Promise<ResolvedAddress | null> {
  const key = cacheKey(lat, lng);

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  // If an identical lookup is already running, share it rather than
  // firing a second request. The controller can call this every few
  // seconds as the user moves.
  if (inFlight && inFlightKey === key) return inFlight;

  inFlightKey = key;
  inFlight = (async (): Promise<ResolvedAddress | null> => {
    try {
      await politeDelay();
      let parts = await fromNominatim(lat, lng);
      let source: ResolvedAddress['source'] = hasAnything(parts) ? 'nominatim' : 'none';

      // Only escalate when the previous geocoder produced nothing usable. A
      // partial answer from a better source is never replaced by a worse one.
      if (!hasAnything(parts)) {
        await politeDelay();
        parts = await fromPhoton(lat, lng);
        if (hasAnything(parts)) source = 'photon';
      }

      if (!hasAnything(parts)) {
        const coarse = await fromBigDataCloud(lat, lng);
        if (hasAnything(coarse)) {
          parts = mergeParts(parts, coarse);
          source = 'bigdatacloud';
        }
      }

      if (!hasAnything(parts)) {
        // Nothing resolvable. Cache the miss briefly so a retry storm does not
        // hammer three services, and let the caller show an honest label.
        cache.set(key, { at: Date.now(), value: null });
        return null;
      }

      const value = buildResolvedAddress(parts!, accuracyMeters, source);

      cache.set(key, { at: Date.now(), value });
      return value;
    } catch {
      // Offline, aborted, or malformed. Cache briefly so we don't retry
      // immediately on the next GPS tick.
      cache.set(key, { at: Date.now() - CACHE_TTL_MS + 20_000, value: null });
      return null;
    } finally {
      if (inFlightKey === key) inFlight = null;
    }
  })();

  return inFlight;
}

/** Clears cached lookups — used on logout so a new user starts fresh. */
export function clearLocationCache() {
  cache.clear();
  inFlight = null;
  inFlightKey = '';
}

/**
 * A label to show when geocoding is unavailable. Honest about being
 * approximate — never a fabricated street name, and never a raw coordinate
 * pair (see the header note; that string was reported as "an IP address").
 */
export function fallbackLabelFor(
  _lat: number,
  _lng: number,
  accuracyMeters: number | null,
): ResolvedAddress {
  const coarse =
    accuracyMeters !== null && accuracyMeters > MAX_ACCURACY_FOR_STREET_METERS;
  return {
    road: null,
    town: null,
    state: null,
    country: null,
    label: coarse
      ? `Approximate location (±${Math.round(accuracyMeters!)}m)`
      : 'Location unavailable',
    precision: 'approximate',
    accuracyMeters,
    source: 'none',
  };
}

export const locationService = {
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  },

  /**
   * A fix precise enough to be worth using. Rejects the (0,0) null island
   * and any reading so vague it would place the user in the wrong city.
   */
  isUsableFix: (lat: number, lng: number, accuracyMeters: number | null): boolean => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false; // classic broken-GPS value
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    if (accuracyMeters !== null && accuracyMeters > 5000) return false;
    return true;
  },

  getCurrentPosition: async (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  },
};

/**
 * True when a string is a bare decimal coordinate pair, e.g. "6.5833, 3.3667".
 *
 * Used as a final safety net anywhere an address is *stored* or *shown to other
 * people*: a coordinate pair must never reach a display name or a profile
 * field, whatever produced it. Returning true here means "do not persist this".
 */
export function looksLikeCoordinates(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\s*-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}\s*$/.test(value);
}
