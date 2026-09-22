import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { isLocationSuccess, type LocationFailure, type LocationOutcome } from '../services/geolocation';
import { auth } from '../../../firebase';

/**
 * The location status the UI reads to decide whether it knows where the user is.
 *
 * Declared here, beside the tracking that produces it, rather than in the
 * controller — the controller consumes this type, it does not own it.
 */
export type LocationStatus =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'ready'; viaGesture: boolean }
  | { state: 'failed'; failure: LocationFailure };

export interface UseLocationTrackingDeps {
  /** Runs the effects once per signed-in user. */
  currentUser: unknown;
  /** Last coordinates we published; read by the heartbeat to avoid duplicate writes. */
  latestCoordsRef: MutableRefObject<{ lat: number; lng: number } | null>;
  /** From `features/maps/services/geolocation` — the browser-agnostic retry ladder. */
  requestLocation: (fromUserGesture?: boolean) => Promise<LocationOutcome>;
  /**
   * Publishes a fix: rate-limited, reverse-geocoded, and written to the backend.
   * Owned by the controller because it also updates `selectedPreset`.
   *
   * Returns the resolved preset rather than void — the controller uses the
   * result, so the return type is left open here instead of being narrowed to
   * `void`, which would make the real implementation fail to typecheck.
   */
  updatePresetWithCoordinates: (
    lat: number,
    lng: number,
    force?: boolean,
    extra?: { accuracy?: number; heading?: number | null; speed?: number | null },
  ) => Promise<unknown>;
  setUserCoords: (coords: { lat: number; lng: number }) => void;
  setGpsSynced: (synced: boolean) => void;
  setLocationStatus: Dispatch<SetStateAction<LocationStatus>>;
}

/**
 * Keeps the user's location current.
 *
 * Extracted from `useNearbyController`, where it was ~150 lines embedded in a
 * ~6,000-line hook. Two effects live here:
 *
 *   1. **The steady-state watch.** `watchPosition` with a high-accuracy
 *      configuration, falling back to standard accuracy if that errors — which
 *      it does on devices that cannot get a satellite fix indoors. Pushes each
 *      meaningful movement through `updatePresetWithCoordinates`, plus a 90 s
 *      heartbeat while the tab is visible so a stationary user stays
 *      discoverable.
 *
 *   2. **The initial acquisition.** `watchPosition` alone is not enough for a
 *      first fix on every browser — iOS Safari resolves the permission request
 *      instantly and silently when it was previously denied, never fires at all
 *      outside a secure context, and routinely times out on a cold GPS start.
 *      `requestLocation` runs the typed retry ladder for those cases.
 *
 * Both are deliberately silent on failure: they record the reason on
 * `locationStatus` and let the header decide what to show. A location failure
 * must never block the rest of the application.
 */
export function useLocationTracking({
  currentUser,
  latestCoordsRef,
  requestLocation,
  updatePresetWithCoordinates,
  setUserCoords,
  setGpsSynced,
  setLocationStatus,
}: UseLocationTrackingDeps): void {
    useEffect(() => {
      let watchId: number | null = null;
      let fallbackWatchId: number | null = null;
    
      // Function to start watching position
      const startMappTracking = () => {
        if (navigator.geolocation) {
          watchId = navigator.geolocation.watchPosition(
            async (position) => {
              const { latitude, longitude, accuracy, heading, speed } = position.coords;
            
              // Check if coordinates have actually changed significantly (e.g., > 0.00002 decimal degrees ~2 meters)
              const prevCoords = latestCoordsRef.current;
              const diffLat = prevCoords ? Math.abs(prevCoords.lat - latitude) : Infinity;
              const diffLng = prevCoords ? Math.abs(prevCoords.lng - longitude) : Infinity;
            
              if (!prevCoords || diffLat > 0.00002 || diffLng > 0.00002) {
                const newCoords = { lat: latitude, lng: longitude };
                latestCoordsRef.current = newCoords;
                setUserCoords(newCoords);
                setGpsSynced(true);
                setLocationStatus(prev => (prev.state === 'ready' ? prev : { state: 'ready', viaGesture: false }));
                await updatePresetWithCoordinates(latitude, longitude, false, { accuracy, heading, speed });
              }
            },
            (error) => {
              console.warn("High-accuracy geolocation watch failed, trying standard-accuracy fallback:", error);
              if (navigator.geolocation) {
                if (watchId !== null) {
                  try { navigator.geolocation.clearWatch(watchId); } catch(e){}
                  watchId = null;
                }
                fallbackWatchId = navigator.geolocation.watchPosition(
                  async (fallbackPos) => {
                    const { latitude, longitude, accuracy, heading, speed } = fallbackPos.coords;
                  
                    const prevCoords = latestCoordsRef.current;
                    const diffLat = prevCoords ? Math.abs(prevCoords.lat - latitude) : Infinity;
                    const diffLng = prevCoords ? Math.abs(prevCoords.lng - longitude) : Infinity;
                  
                    if (!prevCoords || diffLat > 0.00002 || diffLng > 0.00002) {
                      const newCoords = { lat: latitude, lng: longitude };
                      latestCoordsRef.current = newCoords;
                      setUserCoords(newCoords);
                      setGpsSynced(true);
                      setLocationStatus(prev => (prev.state === 'ready' ? prev : { state: 'ready', viaGesture: false }));
                      await updatePresetWithCoordinates(latitude, longitude, false, { accuracy, heading, speed });
                    }
                  },
                  (fbError) => {
                    console.warn("Standard-accuracy geolocation watch failed/blocked (expected in sandboxed iframes):", fbError);
                  },
                  { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
                );
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      };

      startMappTracking();

      // ---------------------------------------------------------------
      // Location HEARTBEAT - this is what makes two real phones see each other.
      //
      // `locationUpdatedAt` is treated as stale after 5 minutes by the users
      // listener, and anyone stale is dropped from the radar. But the ONLY thing
      // that ever refreshed it was the watchPosition callback, and that callback
      // only fires when the device physically moves more than ~2 metres. So a
      // phone sitting still on a table stopped publishing within 5 minutes and
      // then vanished from every other user's radar - which is exactly the
      // "two phones, two accounts, they can't see each other" symptom. Both
      // devices go stale while you're standing there staring at them.
      //
      // A periodic forced re-write keeps the timestamp fresh while the app is
      // open. `force` bypasses the 15s rate-limit and the 15m-moved gate.
      const heartbeat = setInterval(() => {
        if (document.visibilityState === 'hidden') return; // don't burn quota in the background
        const coords = latestCoordsRef.current;
        if (!coords || !auth.currentUser) return;
        updatePresetWithCoordinates(coords.lat, coords.lng, true).catch(() => {});
      }, 90000); // 90s - comfortably inside the 5 minute staleness window

      // Also publish immediately on regaining focus, so switching back to the app
      // makes you discoverable again right away instead of after the next tick.
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return;
        const coords = latestCoordsRef.current;
        if (!coords || !auth.currentUser) return;
        updatePresetWithCoordinates(coords.lat, coords.lng, true).catch(() => {});
      };
      document.addEventListener('visibilitychange', onVisible);

      return () => {
        clearInterval(heartbeat);
        document.removeEventListener('visibilitychange', onVisible);
        if (navigator.geolocation) {
          if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(e){} }
          if (fallbackWatchId !== null) { try { navigator.geolocation.clearWatch(fallbackWatchId); } catch(e){} }
        }
      };
    }, [currentUser]);

    // -----------------------------------------
    // Initial location acquisition
    // -----------------------------------------
    //
    // `watchPosition` above is the steady-state tracker, but on its own it is not
    // enough to get a first fix on every browser. iOS Safari in particular will
    // resolve the permission request instantly and silently when it was previously
    // denied, will never fire at all outside a secure context, and routinely times
    // out on a cold GPS start. Chrome prompts and succeeds, which is why this only
    // ever reproduced on the user's iPhone.
    //
    // `acquireLocation` runs the typed retry ladder for those cases and reports
    // back a reason we can actually show the user. On success the coordinates are
    // pushed through the same `updatePresetWithCoordinates` pipeline as the watch,
    // so `selectedPreset` becomes a real place name rather than a demo one.
    useEffect(() => {
      let cancelled = false;

      (async () => {
        const outcome = await requestLocation();

        if (cancelled) return;

        if (!isLocationSuccess(outcome)) {
          // Nothing to publish. `locationStatus` now carries the reason and the
          // header shows "Location not set" rather than a neighbourhood name.
          console.warn('[location] initial fix unavailable:', outcome.reason);
          return;
        }

        const newCoords = { lat: outcome.latitude, lng: outcome.longitude };
        latestCoordsRef.current = newCoords;
        setUserCoords(newCoords);
        setGpsSynced(true);

        try {
          await updatePresetWithCoordinates(outcome.latitude, outcome.longitude, false, {
            accuracy: outcome.accuracyMeters ?? undefined,
          });
        } catch (err) {
          console.warn('[location] reverse-geocode failed for initial fix:', err);
        }
      })();

      return () => { cancelled = true; };
      // Intentionally run once per signed-in user. `requestLocation` is stable.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);
}
