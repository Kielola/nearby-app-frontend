/**
 * Cross-browser location acquisition.
 *
 * WHY THIS EXISTS
 * ===============
 * The app used to call `navigator.geolocation.getCurrentPosition` inline, in
 * half a dozen components, and silently fall back to a hard-coded demo
 * neighbourhood when it failed. On iOS Safari that fallback was not obvious: the
 * permission prompt never appeared, the call failed, and the UI displayed
 * "Ogo-Oluwa, Osogbo" — a demo location in Osun State — as though it were the
 * user's real position. On Chrome the prompt appeared, permission was granted,
 * and the real fix overwrote it, so the bug only showed up on some devices.
 *
 * Presenting a fake location as real is worse than showing nothing: users
 * believe they are being placed correctly. This module makes the *outcome*
 * explicit and typed, so callers cannot accidentally treat "no location" as
 * "some location".
 *
 * BROWSER NOTES THAT DRIVE THE DESIGN
 * ===================================
 * - **Safari requires a secure context.** On plain HTTP, `geolocation` exists
 *   but the callback never fires and no error is raised. We detect this and say
 *   so rather than hanging.
 * - **Safari resolves `PERMISSION_DENIED` instantly** (code 1) when the site was
 *   previously denied, without prompting. Retrying blindly never works; the user
 *   has to change iOS Settings, so we surface that instruction.
 * - **iOS can time out** (code 3) on a cold GPS start. A retry with lower
 *   accuracy and a longer timeout usually succeeds, so we do that automatically.
 * - **`maximumAge: 0` forces a fresh fix**, which matters because a stale cached
 *   position is how a user ends up shown at a place they left an hour ago.
 * - `permissions.query` is unavailable on older Safari, so every use is guarded.
 *
 * Nothing here throws. Every path returns a discriminated union, because a
 * thrown error is exactly what got swallowed before.
 */

export type LocationFailureReason =
  /** Browser has no geolocation API at all. */
  | 'unsupported'
  /** Page is not HTTPS — browsers block geolocation entirely. */
  | 'insecure-context'
  /** User said no (or previously said no and is not being asked again). */
  | 'permission-denied'
  /** We could not get a fix in the time allowed. */
  | 'timeout'
  /** Hardware/OS could not produce a position at all. */
  | 'unavailable'
  /** A fix arrived but was too vague to be worth showing. */
  | 'imprecise'
  /** Anything else, with the original message preserved. */
  | 'unknown';

export interface LocationFailure {
  ok: false;
  reason: LocationFailureReason;
  /** Safe to show a user. Already written in plain language. */
  message: string;
  /** True when retrying in the same session can plausibly help. */
  retryable: boolean;
  /** True when the user must change something in their own settings first. */
  requiresUserAction: boolean;
}

export interface LocationSuccess {
  ok: true;
  latitude: number;
  longitude: number;
  /** Metres. null when the device did not report one. */
  accuracyMeters: number | null;
  /** Epoch ms. */
  timestamp: number;
  /** How we obtained it — useful for diagnostics. */
  source: 'fresh' | 'retry-low-accuracy';
}

export type LocationOutcome = LocationSuccess | LocationFailure;

/**
 * Explicit type guards.
 *
 * These exist rather than relying on `if (x.ok)` narrowing. That looked like it
 * should work — `ok` is a `true`/`false` literal on each member — but through
 * this module's re-exports TypeScript kept widening back to the union and
 * refusing to narrow, which produced "Property 'reason' does not exist on type
 * 'LocationSuccess'". A named guard is unambiguous, reads better at the call
 * site, and exports the narrowing to every caller.
 */
export function isLocationSuccess(outcome: LocationOutcome): outcome is LocationSuccess {
  return outcome.ok === true;
}

export function isLocationFailure(outcome: LocationOutcome): outcome is LocationFailure {
  return outcome.ok === false;
}

/** A fix vaguer than this would place the user in the wrong neighbourhood. */
export const MAX_USABLE_ACCURACY_METERS = 5000;

/** Cold-start fixes worse than this are re-requested at lower accuracy. */
const RETRY_ACCURACY_THRESHOLD_METERS = 1000;

function isUsable(lat: number, lng: number, accuracy: number | null): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false; // "null island" — a broken-GPS value
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (accuracy !== null && accuracy > MAX_USABLE_ACCURACY_METERS) return false;
  return true;
}

/** Map a raw GeolocationPositionError onto our vocabulary. */
function classify(error: GeolocationPositionError): LocationFailure {
  // Compare against the spec's numeric codes (1/2/3), NOT against
  // `error.PERMISSION_DENIED` and friends.
  //
  // Reading the constant off the instance looks identical and works in Chrome
  // and Safari, where it is inherited from the prototype. But any environment
  // that hands back a plain object — some Android WebViews, in-app browsers
  // (Instagram, Facebook, TikTok), and a few polyfills — has no such property,
  // so every case misses, `code: 1` falls through to `default`, and a denied
  // permission gets reported as an unexplained failure. The numeric values are
  // fixed by the W3C spec and cannot drift.
  const PERMISSION_DENIED = 1;
  const POSITION_UNAVAILABLE = 2;
  const TIMEOUT_CODE = 3;

  switch (error.code) {
    case PERMISSION_DENIED:
      return {
        ok: false,
        reason: 'permission-denied',
        // Deliberately actionable: on iOS the fix is in Settings, and a bare
        // "permission denied" leaves people stuck.
        message:
          'Location permission is off for Nearby. On iPhone: Settings → Safari ' +
          '→ Location → Allow. On Android: tap the padlock in the address bar ' +
          '→ Permissions → Location → Allow. Then tap Retry.',
        // NOT retryable: an automatic retry cannot change a permission setting,
        // so it would just burn a second full timeout before giving up. iOS
        // Safari is especially literal here — once denied it resolves instantly
        // and never prompts again for that page. The user must act first, hence
        // `requiresUserAction`, which is what the UI turns into "Enable Location".
        retryable: false,
        requiresUserAction: true,
      };
    case TIMEOUT_CODE:
      return {
        ok: false,
        reason: 'timeout',
        message:
          "We couldn't get a location fix in time. Move somewhere with a clearer " +
          'view of the sky, or turn on Wi-Fi, then try again.',
        retryable: true,
        requiresUserAction: false,
      };
    case POSITION_UNAVAILABLE:
      return {
        ok: false,
        reason: 'unavailable',
        message:
          'Your device could not determine a location right now. Check that ' +
          'Location Services are switched on for your browser, then try again.',
        retryable: true,
        requiresUserAction: true,
      };
    default:
      return {
        ok: false,
        reason: 'unknown',
        message: error.message || 'Location could not be determined.',
        retryable: true,
        requiresUserAction: false,
      };
  }
}

/**
 * Ask the browser what it already knows about permission, without prompting.
 * Returns null when the browser cannot tell us (older Safari, Firefox quirks).
 */
export async function getPermissionState(): Promise<'granted' | 'denied' | 'prompt' | null> {
  try {
    // `permissions` is unavailable in older Safari; `geolocation` as a
    // PermissionName is unsupported in some Firefox builds.
    const permissions = (navigator as Navigator & {
      permissions?: { query(d: { name: string }): Promise<PermissionStatus> };
    }).permissions;
    if (!permissions?.query) return null;
    const status = await permissions.query({ name: 'geolocation' });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return null;
  } catch {
    // Firefox throws for the geolocation name; that is fine, we just don't know.
    return null;
  }
}

/** Environment problems that no amount of retrying will fix. */
function environmentProblem(): LocationFailure | null {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'This browser does not support location. Try Chrome, or Safari on iOS ' +
        '16 or newer.',
      retryable: false,
      requiresUserAction: false,
    };
  }
  // Browsers silently refuse geolocation on insecure origins — the API exists
  // but the callback never fires. Catching it here turns a permanent spinner
  // into a clear message.
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return {
      ok: false,
      reason: 'insecure-context',
      message: 'Location needs a secure (https://) connection. This page is not secure.',
      retryable: false,
      requiresUserAction: false,
    };
  }
  return null;
}

function getCurrentPositionOnce(options: PositionOptions): Promise<LocationOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: LocationOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const accuracyMeters = Number.isFinite(accuracy) ? accuracy : null;
          if (!isUsable(latitude, longitude, accuracyMeters)) {
            finish({
              ok: false,
              reason: 'imprecise',
              message:
                'The location we got was too vague to place you accurately. ' +
                'Try again in a moment.',
              retryable: true,
              requiresUserAction: false,
            });
            return;
          }
          finish({
            ok: true,
            latitude,
            longitude,
            accuracyMeters,
            timestamp: position.timestamp || Date.now(),
            source: 'fresh',
          });
        },
        (error) => finish(classify(error)),
        options,
      );
    } catch (err) {
      // Some browsers throw synchronously rather than calling the error callback.
      finish({
        ok: false,
        reason: 'unknown',
        message: err instanceof Error ? err.message : 'Location request failed.',
        retryable: true,
        requiresUserAction: false,
      });
    }
  });
}

export interface AcquireOptions {
  /**
   * Set when the call is happening inside a user gesture (a tap). iOS Safari is
   * markedly more reliable at showing the permission prompt when it is, and
   * some browsers refuse otherwise.
   */
  fromUserGesture?: boolean;
  /** Skip the automatic lower-accuracy retry. */
  singleAttempt?: boolean;
  /**
   * Override how long each attempt may take, in milliseconds.
   *
   * Defaults are 10s for a background attempt, 15s when triggered by a tap (iOS
   * shows its permission sheet during that window and the clock is running), and
   * 15s for the lower-accuracy retry. Callers that need a shorter wait — or a
   * test that cannot afford a real GPS cold start — can set this. Browsers treat
   * it as a hint rather than a guarantee, so it is an upper bound, not an exact
   * timer.
   */
  timeoutMs?: number;
}

/**
 * Obtain a location fix, with one automatic retry at lower accuracy.
 *
 * The retry matters: a cold GPS start frequently returns either a timeout or a
 * fix several kilometres wide. Asking again with `enableHighAccuracy: false`
 * usually succeeds quickly, because it lets the device use wifi/cell positioning
 * instead of waiting on satellites.
 */
export async function acquireLocation(options: AcquireOptions = {}): Promise<LocationOutcome> {
  const problem = environmentProblem();
  if (problem) return problem;

  const firstTimeout = options.timeoutMs ?? (options.fromUserGesture ? 15_000 : 10_000);

  const first = await getCurrentPositionOnce({
    enableHighAccuracy: true,
    timeout: firstTimeout,
    maximumAge: 0, // never hand back a stale position as if it were current
  });

  if (isLocationFailure(first)) {
    // A failure we cannot improve on (denied, unsupported) — report it as-is.
    if (!first.retryable || options.singleAttempt) return first;
  } else {
    const vague =
      first.accuracyMeters !== null && first.accuracyMeters > RETRY_ACCURACY_THRESHOLD_METERS;
    // Good enough already — don't spend the user's time on a second attempt.
    if (!vague || options.singleAttempt) return first;
    // Otherwise fall through: a 3 km fix would name the wrong street, so the
    // lower-accuracy retry is worth one more round trip.
  }

  const second = await getCurrentPositionOnce({
    enableHighAccuracy: false,
    timeout: options.timeoutMs ?? 15_000,
    maximumAge: 0,
  });

  if (isLocationSuccess(second)) {
    return { ...second, source: 'retry-low-accuracy' };
  }
  // Both attempts failed. Report the FIRST one — if the first was denied and the
  // retry merely timed out, "permission denied" is the far more useful message.
  return first;
}

/**
 * Watch position, but only ever emit fixes good enough to display.
 *
 * `watchPosition` is used for live movement. It is deliberately separate from
 * `acquireLocation` because browsers treat them differently — and on iOS a
 * watch that starts before permission is granted can silently never fire.
 */
export function watchLocation(
  onFix: (fix: LocationSuccess) => void,
  onFailure?: (failure: LocationFailure) => void,
): () => void {
  const problem = environmentProblem();
  if (problem) {
    onFailure?.(problem);
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const accuracyMeters = Number.isFinite(accuracy) ? accuracy : null;
      if (!isUsable(latitude, longitude, accuracyMeters)) return; // ignore, keep watching
      onFix({
        ok: true,
        latitude,
        longitude,
        accuracyMeters,
        timestamp: position.timestamp || Date.now(),
        source: 'fresh',
      });
    },
    (error) => onFailure?.(classify(error)),
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
  );

  return () => {
    try {
      navigator.geolocation.clearWatch(id);
    } catch {
      /* already cleared */
    }
  };
}

/**
 * Keys that hold a location on this device.
 *
 * Exported so callers can wipe them together. Used to clear a demo preset that
 * had been persisted as though it were the user's real position — the reason a
 * Safari user saw an Osogbo neighbourhood while sitting in Lagos.
 */
export const STORED_LOCATION_KEYS = ['nearby_selected_preset', 'nearby_user_address'] as const;

export function clearStoredLocation(): void {
  try {
    for (const key of STORED_LOCATION_KEYS) localStorage.removeItem(key);
  } catch {
    /* private browsing, storage disabled — nothing to clear */
  }
}
