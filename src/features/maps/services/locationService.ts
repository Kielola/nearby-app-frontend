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
 *     point returns a street you are not on — which is exactly how a user
 *     ends up labelled with a road near the lagoon they've never visited.
 *   • When the lookup failed, the user was given a real-sounding but
 *     entirely invented address ("Gbongan Road, Osogbo, Osun") — a
 *     location up to 250 km away — and it was persisted.
 *   • Because the invented value was saved, it stuck: reloads restored the
 *     wrong address from localStorage and the profile document.
 *
 * So the rules this module enforces:
 *
 *   • Reject fixes too imprecise to name a street, rather than geocoding
 *     them anyway.
 *   • NEVER invent a street name. If we can't resolve one, return a label
 *     that is honestly approximate.
 *   • Cache successful lookups so one fix = one network call.
 *   • Deduplicate in-flight lookups (the controller polls on an interval).
 *   • Respect Nominatim's usage policy. It's a free service run on
 *     donations with a hard 1 req/sec limit; hammering it gets you
 *     IP-banned, which silently degrades EVERY user's address to the
 *     fallback path above.
 */

export interface ResolvedAddress {
  /** Street name, or null when we genuinely could not determine one. */
  road: string | null;
  /** Area / district / city. */
  town: string | null;
  /** State, e.g. "Lagos". */
  state: string | null;
  /** Full label for display. Always honest about its precision. */
  label: string;
  /** How the label was derived — lets the UI avoid over-claiming. */
  precision: 'street' | 'area' | 'coordinates';
  accuracyMeters: number | null;
}

/**
 * Above this, the fix is too coarse to attach a street name to. A 150 m
 * reading can easily be one or two streets out, and naming the wrong
 * street to a user who is arranging to meet a stranger is worse than
 * naming none. Deliberately conservative.
 */
export const MAX_ACCURACY_FOR_STREET_METERS = 150;

/** Nominatim asks for max 1 request/second. We stay well under. */
const MIN_MS_BETWEEN_GEOCODES = 1100;

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

/**
 * Reverse-geocode one coordinate pair.
 * Returns null when no address could be resolved — callers must handle
 * that honestly rather than substituting a fake street.
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
    // Rate limit: never more than ~1 req/sec to Nominatim.
    const sinceLast = Date.now() - lastRequestAt;
    if (sinceLast < MIN_MS_BETWEEN_GEOCODES) {
      await sleep(MIN_MS_BETWEEN_GEOCODES - sinceLast);
    }
    lastRequestAt = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        {
          signal: controller.signal,
          headers: {
            // Nominatim's usage policy requires an identifying
            // User-Agent or Referer. Sending neither is a common cause
            // of silent 403s, which then looked identical to "no
            // address here" and triggered the old fake-street fallback.
            'Accept-Language': 'en',
          },
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        // 403/429 means we're being throttled or blocked. Cache the
        // negative result briefly so a retry storm doesn't deepen it.
        cache.set(key, { at: Date.now(), value: null });
        return null;
      }

      const data = await res.json();
      const addr = data?.address ?? {};

      const road: string | null =
        addr.road || addr.pedestrian || addr.footway || addr.path || null;
      const town: string | null =
        addr.suburb ||
        addr.neighbourhood ||
        addr.city_district ||
        addr.town ||
        addr.city ||
        addr.village ||
        null;
      const state: string | null = addr.state || addr.county || null;

      const tooCoarse =
        accuracyMeters !== null && accuracyMeters > MAX_ACCURACY_FOR_STREET_METERS;

      // Only claim a street if we actually got one AND the fix was
      // precise enough for that claim to mean something.
      const useStreet = Boolean(road) && !tooCoarse;

      let label: string;
      let precision: ResolvedAddress['precision'];

      if (useStreet) {
        label = [road, town, state].filter(Boolean).join(', ');
        precision = 'street';
      } else if (town) {
        label = [town, state].filter(Boolean).join(', ');
        precision = 'area';
      } else {
        label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        precision = 'coordinates';
      }

      const value: ResolvedAddress = {
        road: useStreet ? road : null,
        town,
        state,
        label,
        precision,
        accuracyMeters,
      };

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
 * approximate — never a fabricated street name.
 */
export function fallbackLabelFor(
  lat: number,
  lng: number,
  accuracyMeters: number | null,
): ResolvedAddress {
  const coarse =
    accuracyMeters !== null && accuracyMeters > MAX_ACCURACY_FOR_STREET_METERS;
  return {
    road: null,
    town: null,
    state: null,
    label: coarse
      ? `Approximate location (±${Math.round(accuracyMeters!)}m)`
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    precision: 'coordinates',
    accuracyMeters,
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
