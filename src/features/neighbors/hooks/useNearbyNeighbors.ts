import { useEffect } from 'react';
import { Neighbor } from '../../../types';

/**
 * Turning the nearby-users result into neighbours
 *
 * Converts the backend's rows into the shape the radar and list render, including the distance in metres and the walking estimate. This is the one place the two representations meet.
 *
 * Every value this block reads is declared in `UseNearbyNeighborsDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseNearbyNeighborsDeps {
  currentUser: any;
  nearbyUsersData: any;
  neighborStories: any;
  radarRadius: any;
  setNeighbors: any;
}

export function useNearbyNeighbors(deps: UseNearbyNeighborsDeps) {
  const {
  
    currentUser,
    nearbyUsersData,
    neighborStories,
    radarRadius,
    setNeighbors,} = deps;

useEffect(() => {
  if (!nearbyUsersData || !currentUser) return;

  const realUsers: Neighbor[] = nearbyUsersData.map((u) => {
    const distanceMeters = u.distance_km != null ? Math.round(parseFloat(u.distance_km) * 1000) : undefined;
    const walkingMins = distanceMeters !== undefined ? Math.max(1, Math.ceil(distanceMeters / 78)) : 1;

    // Fields below with hardcoded fallbacks (avatarColor, avatarEmoji,
    // trustScore, verificationLevel, etc.) mirror the SAME fallback
    // defaults the old Firestore-backed version used — these were never
    // actually backed by real per-user data there either. They're
    // genuine backend gaps (no ratings/reputation/verification system
    // exists yet) rather than something this migration regressed.
    return {
      id: u.id,
      name: u.display_name || 'Anonymous User',
      username: (u.display_name || 'anon').toLowerCase().replace(/\s+/g, '_'),
      avatarColor: 'bg-indigo-600 border border-indigo-700',
      avatarEmoji: '🙋‍♂️',
      customProfilePhoto: u.avatar_url || undefined,
      distanceMeters,
      // Real label resolved by the neighbour's own device and synced to
      // Postgres. Previously this was hardcoded to
      // getStateStreets('Osun')[0] -> every user in the app displayed
      // "Gbongan Rd", a street in Osogbo, regardless of where they were.
      // When they genuinely haven't shared one we say so instead of
      // inventing it.
      streetName:
        u.street_name ||
        (distanceMeters !== undefined ? `${walkingMins} mins trek away` : 'Nearby'),
      bio: u.bio || 'Connected in Nigeria!',
      interests: ['Tech', 'Street Food'],
      publicSnaps: [],
      activeStory: neighborStories[u.id] || [],
      // Comes straight from the backend now (one Redis mget for the
      // whole page) rather than a client-side Firestore listener.
      onlineStatus: u.is_online ? 'online' : 'offline',
      latOffset: 0,
      lngOffset: 0,
      isOutsideRadar: distanceMeters !== undefined ? distanceMeters > radarRadius : true,
      isFriend: u.is_friend,
      ageRange: '25-34',
      gender: 'Male',
      communities: ['comm-1'],
      trustScore: 5.0,
      meetupsCompleted: 0,
      ratingsCount: 0,
      totalRatingPoints: 0,
      reportsCount: 0,
      banned: false, // banned users are already excluded server-side
      verificationLevel: 'Basic',
      dayTimeAvailability: 'Available Right Now',
      ratedBy: {},
    } as Neighbor;
  });

  setNeighbors(prev => {
    // Drop the mock/demo neighbors entirely once real data is flowing —
    // group chats are locally-created and always kept.
    const cleanPrev = prev.filter(n => n.isGroup);
    const combined = [...realUsers, ...cleanPrev];
    const unique: Neighbor[] = [];
    const seen = new Set();
    combined.forEach(n => {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        unique.push(n);
      }
    });
    return unique;
  });
}, [nearbyUsersData, currentUser, radarRadius]);
}

export default useNearbyNeighbors;
