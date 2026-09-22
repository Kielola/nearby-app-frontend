import type { Dispatch, SetStateAction } from 'react';
import { radarApi, usersApi } from '../../../lib/api';
import { LocationPreset } from '../../../mockData';
import {
  acquireLocation,
  clearStoredLocation,
  isLocationFailure,
  type LocationOutcome,
} from '../services/geolocation';
import { fallbackLabelFor, locationService, reverseGeocode } from '../services/locationService';
import { useCallback } from 'react';

/**
 * Location requests and preset persistence
 *
 * The tap-to-retry location path, the distance helper, and saving a custom location preset.
 *
 * ## Dependency interface
 *
 * 4 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseLocationActionsDeps {
  lastLocationWriteRef: any;
  setLocationStatus: Dispatch<SetStateAction<any>>;
  setUserAddress: Dispatch<SetStateAction<any>>;
  userAddress: any;
  setSelectedPreset: any;
}

export function useLocationActions(deps: UseLocationActionsDeps) {
  const {
    lastLocationWriteRef,
    setLocationStatus,
    setUserAddress,
    userAddress,
    setSelectedPreset,
  } = deps;

    const requestLocation = useCallback(async (fromUserGesture = false): Promise<LocationOutcome> => {
      setLocationStatus({ state: 'locating' });

      const outcome = await acquireLocation({ fromUserGesture });

      if (isLocationFailure(outcome)) {
        setLocationStatus({ state: 'failed', failure: outcome });

        // A demo preset is not a location. Wipe any stored one so it cannot be
        // displayed as the user's real position after a failed acquisition — this
        // is the specific fix for the Safari "Ogo-Oluwa" report.
        //
        // Not done on a plain timeout: that is usually transient, and throwing
        // away a previously good location would be worse than keeping it.
        if (outcome.reason !== 'timeout') {
          clearStoredLocation();
        }
        return outcome;
      }

      setLocationStatus({ state: 'ready', viaGesture: fromUserGesture });
      return outcome;
    }, []);

  // ── moved from src/app/hooks/useNearbyController.ts lines 292-305 ──

    const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3; // meters
      const phi1 = (lat1 * Math.PI) / 180;
      const phi2 = (lat2 * Math.PI) / 180;
      const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
      const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // in meters
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 334-420 ──

    const updatePresetWithCoordinates = async (
      lat: number,
      lng: number,
      force = false,
      extraCoords?: { accuracy?: number | null; heading?: number | null; speed?: number | null },
    ) => {
      const accuracy = extraCoords?.accuracy ?? null;

      // Reject fixes we can't trust before they reach the geocoder. A
      // cold-start reading in the 500m-3km range is normal here and will
      // happily resolve to a street the user has never been on.
      if (!locationService.isUsableFix(lat, lng, accuracy)) {
        console.warn('[location] discarding unusable GPS fix', { lat, lng, accuracy });
        return null;
      }

      try {
        const now = Date.now();
        const lastWrite = lastLocationWriteRef.current;
        const distanceMoved =
          lastWrite.time === 0
            ? 0
            : calculateHaversineDistance(lat, lng, lastWrite.lat, lastWrite.lng);
        const timePassed = now - lastWrite.time;

        // Coordinates go to the backend promptly — radar depends on them and
        // they must never be blocked behind address resolution.
        const shouldWriteToNetwork =
          force || lastWrite.time === 0 || distanceMoved >= 15 || timePassed >= 60000;

        if (shouldWriteToNetwork) {
          lastWrite && (lastLocationWriteRef.current = { lat, lng, time: now });
          try {
            await radarApi.updateLocation(lat, lng);
          } catch (e) {
            console.warn('Could not sync coordinates to backend:', e);
          }
        }

        // Fast path: if we already have a label and nothing meaningful has
        // changed, don't re-resolve. reverseGeocode caches internally too,
        // this just avoids the call entirely on every GPS tick.
        if (!shouldWriteToNetwork && userAddress) {
          return null;
        }

        const resolved =
          (await reverseGeocode(lat, lng, accuracy)) ??
          fallbackLabelFor(lat, lng, accuracy);

        setUserAddress(resolved.label);

        const newPreset: LocationPreset = {
          name: resolved.label,
          city: resolved.state ?? resolved.town ?? '',
          coords: { lat, lng },
          streets: resolved.road ? [resolved.road] : [],
        };
        setSelectedPreset(newPreset);

        try {
          localStorage.setItem('nearby_last_user_coords', JSON.stringify({ lat, lng }));
          localStorage.setItem('nearby_user_address', resolved.label);
          localStorage.setItem('nearby_selected_preset', JSON.stringify(newPreset));
        } catch (_) {}

        // Only publish a street label we actually stand behind. This value
        // is shown to OTHER users on their radar, so a guess here becomes
        // someone else's misinformation. If the fix was too coarse we send
        // coordinates-accuracy only and leave the stored label untouched.
        if (shouldWriteToNetwork && resolved.precision === 'street' && resolved.road) {
          try {
            await usersApi.updateMe({
              streetName: resolved.label,
              locationAccuracy: accuracy,
            });
          } catch (e) {
            console.warn('Could not sync address label to backend:', e);
          }
        }

        return newPreset;
      } catch (err) {
        console.warn('Location update failed:', err);
        return null;
      }
    };

  return {
    calculateHaversineDistance,
    requestLocation,
    updatePresetWithCoordinates,
  };
}
