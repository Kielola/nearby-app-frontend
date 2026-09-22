import { useEffect } from 'react';

/**
 * Ratings shown on a neighbour's profile
 *
 * Maps the ratings the backend returns for the neighbour being viewed into the shape the profile screen renders.
 *
 * Every value this block reads is declared in `UseMeetupRatingsSyncDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseMeetupRatingsSyncDeps {
  profileRatingsData: any;
  setMeetupRatings: any;
}

export function useMeetupRatingsSync(deps: UseMeetupRatingsSyncDeps) {
  const {
  
    profileRatingsData,
    setMeetupRatings,} = deps;

useEffect(() => {
  setMeetupRatings((profileRatingsData ?? []).map(r => ({
    ratingId: r.id,
    meetupId: r.meetupId,
    reviewerUID: r.raterId,
    receiverUID: r.ratedUserId,
    stars: r.rating,
    review: r.comment || '',
    createdAt: r.createdAt,
  })));
}, [profileRatingsData]);
}

export default useMeetupRatingsSync;
