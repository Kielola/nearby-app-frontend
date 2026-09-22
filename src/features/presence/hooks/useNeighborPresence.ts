import { useMemo, useRef, type Dispatch, type SetStateAction } from 'react';

/**
 * Neighbour presence and the discovery feed
 *
 * Who is online right now, which neighbours are real rather than seeded demo data, the widened live-gist feed, and the friend-request inbox.
 *
 * ## Dependency interface
 *
 * 4 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseNeighborPresenceDeps {
  nearbyUsersData: any;
  neighbors: any;
  viewingNeighborProfile: any;
}

export function useNeighborPresence(deps: UseNeighborPresenceDeps) {
  const {
    nearbyUsersData,
    neighbors,
    viewingNeighborProfile,
  } = deps;

  // ── moved from src/app/hooks/useNearbyController.ts lines 838-844 ──

    const neighborLiveGists: Record<string, { status: string; checkedInAt: string; activity: string }> = {
      'nb-1': { status: "🍛 Munching firewood jollof at canteens", checkedInAt: "Yaba Rd", activity: "Eating Out" },
      'nb-2': { status: "💻 Debugging server-side endpoints on Vite", checkedInAt: "Herbert Macaulay Way", activity: "Coding" },
      'nb-3': { status: "🛍️ Buying snacks and soft drinks at local stall", checkedInAt: "Tejuosho St", activity: "Shopping" },
      'nb-4': { status: "⚽️ Tuning up for street footy session", checkedInAt: "Alara St", activity: "Playing football" },
      'nb-5': { status: "🎵 Cooking some cool Yaba afro-fusion beats", checkedInAt: "Montgomery Rd", activity: "Music producing" },
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 1686-1686 ──

    const incomingRequestsByUserIdRef = useRef<Record<string, string>>({});

  // ── moved from src/app/hooks/useNearbyController.ts lines 1948-1954 ──

    const onlineIds = useMemo(
      () =>
        (nearbyUsersData ?? [])
          .filter((u) => u.is_online)
          .map((u) => u.id),
      [nearbyUsersData],
    );

  // ── moved from src/app/hooks/useNearbyController.ts lines 2002-2005 ──

    const realNeighborIds = useMemo(
      () => neighbors.filter(n => !n.id.startsWith('nb-') && !n.isGroup).map(n => n.id),
      [neighbors],
    );

  // ── moved from src/app/hooks/useNearbyController.ts lines 2103-2103 ──

    const viewingRealProfileId = viewingNeighborProfile && !viewingNeighborProfile.id.startsWith('nb-')
      ? viewingNeighborProfile.id
      : null;

  return {
    incomingRequestsByUserIdRef,
    neighborLiveGists,
    onlineIds,
    realNeighborIds,
    viewingRealProfileId,
  };
}
