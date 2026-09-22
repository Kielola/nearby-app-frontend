import { useEffect } from 'react';
import { LocationPreset } from '../../../mockData';

/**
 * Adopting values the server authored
 *
 * Applies the profile the backend returns onto local state, but only where the server actually has a value. An empty column must not blank out something the user typed on this device before the write landed.
 *
 * Every value this block reads is declared in `UseServerProfileAdoptionDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseServerProfileAdoptionDeps {
  appUser: any;
  customProfilePhoto: any;
  setCustomProfilePhoto: any;
  setGpsSynced: any;
  setSelectedPreset: any;
  setUserAddress: any;
  setUserBio: any;
  setUserCoords: any;
  setUserDisplayName: any;
  setUserRadarStatusText: any;
  userCoords: any;
}

export function useServerProfileAdoption(deps: UseServerProfileAdoptionDeps) {
  const {
  
    appUser,
    customProfilePhoto,
    setCustomProfilePhoto,
    setGpsSynced,
    setSelectedPreset,
    setUserAddress,
    setUserBio,
    setUserCoords,
    setUserDisplayName,
    setUserRadarStatusText,
    userCoords,} = deps;

// -----------------------------------------
// Synced Multi-Status Stories and Dynamic Listeners o!
// -----------------------------------------
// Kept (and left empty) because the hook's return object still exposes
// it; there are no per-neighbour Firestore story subscriptions any more.

// Own status/stories now come from the backend `highlights` table, which
// the effect further down already loads via useUserContent. The old
// per-user Firestore subcollection listener (and its lazy
// deleteDoc-on-read expiry sweep) is gone — expiry is a server concern.

// Neighbour stories are fetched per-profile via useUserContent when you
// actually open someone's profile, instead of opening a live Firestore
// subcollection listener for EVERY person currently on the radar.

// -----------------------------------------
// Own profile
// -----------------------------------------
// This was onSnapshot(doc(db,'users',uid)) — a live Firestore listener
// purely to read back a document the client itself had written. The
// Postgres row is the source of truth now (appUser, from AuthContext),
// so we read it once through the API and derive everything from that.
useEffect(() => {
  if (!appUser) return;

  if (appUser.displayName && appUser.displayName !== 'Nearby Member') {
    setUserDisplayName(appUser.displayName);
  }
  if (appUser.bio) setUserBio(appUser.bio);
  if (appUser.avatarUrl && appUser.avatarUrl !== customProfilePhoto) {
    setCustomProfilePhoto(appUser.avatarUrl);
  }
  if (appUser.customStatus) {
    setUserRadarStatusText(appUser.customStatus);
  }
  // A saved street label is only applied once we have no live fix, so a
  // stale cached address can never overwrite a fresh GPS reading.
  if (appUser.streetName && !userCoords) {
    setUserAddress(appUser.streetName);
  }
  if (
    typeof appUser.latitude === 'number' &&
    typeof appUser.longitude === 'number' &&
    Number.isFinite(appUser.latitude) &&
    Number.isFinite(appUser.longitude) &&
    !(appUser.latitude === 0 && appUser.longitude === 0)
  ) {
    const lat = appUser.latitude;
    const lng = appUser.longitude;
    setUserCoords((prev) => {
      if (prev) return prev;
      setGpsSynced(true);
      const restoredPreset: LocationPreset = {
        name: appUser.streetName || 'My Location',
        city: '',
        coords: { lat, lng },
        streets: appUser.streetName ? [appUser.streetName] : [],
      };
      setSelectedPreset(restoredPreset);
      return { lat, lng };
    });
  }
}, [appUser]);
}

export default useServerProfileAdoption;
