import { useEffect } from 'react';

/**
 * Meetups the user has scheduled
 *
 * Projects the polled meetups into the shape the meetups screen renders.
 *
 * Every value this block reads is declared in `UseMeetupsSyncDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseMeetupsSyncDeps {
  myMeetupsData: any;
  setMeetups: any;
}

export function useMeetupsSync(deps: UseMeetupsSyncDeps) {
  const {
  
    myMeetupsData,
    setMeetups,} = deps;

useEffect(() => {
  if (!myMeetupsData) return;
  setMeetups(myMeetupsData.map(m => ({
    meetupId: m.id,
    hostUID: m.requesterId,
    participantUID: m.otherUserId,
    meetingPoint: m.location || '',
    meetingLatitude: 0, // backend stores a location description, not coordinates
    meetingLongitude: 0,
    // Backend distinguishes pending/confirmed; the frontend's 3-state
    // model only has 'scheduled' — both map onto it.
    status: m.status === 'completed' ? 'completed' : m.status === 'cancelled' ? 'cancelled' : 'scheduled',
    scheduledTime: m.scheduledAt || '',
    createdAt: m.createdAt,
  })));
}, [myMeetupsData]);
}

export default useMeetupsSync;
