/**
 * What a new user fills in on the sign-up form, held until their account exists.
 *
 * ## Why this exists
 *
 * The registration fields were previously collected nowhere. A new user gave an
 * email and a password, arrived at an empty profile, and had to go and find a
 * settings screen to say who they were. Most never did — so the radar was full of
 * people with no name, no age and nothing in common to match on.
 *
 * Asking at registration is the right moment: the user is already answering
 * questions, and it is the only point where they are guaranteed to be paying
 * attention to their own profile.
 *
 * ## Why a store rather than props
 *
 * The form is deep inside the auth tree, while the account is created in
 * `useAuthActions`, and there is an async gap between the two — account creation,
 * a network round trip, and a verification email all happen in between. Passing
 * four values down through the sign-up call and back out the other side would mean
 * threading them through several layers that have no interest in them.
 *
 * The values also need to survive that gap if the first save fails: the account is
 * already real at that point, and losing the answers would leave the user with the
 * empty profile this module exists to prevent.
 *
 * The pattern matches `features/chat/composerText.ts` and
 * `features/referrals/pendingCode.ts` — small module-level state with explicit
 * subscribe/read/write, no provider to mount.
 */

import { useSyncExternalStore } from 'react';

export interface SignupProfile {
  /** Display name. Required at registration — this is what neighbours see. */
  displayName: string;
  /** Age in years, or null if the user skipped it. Never guessed. */
  age: number | null;
  /** Chosen interest tags. Empty array means none chosen, not "unknown". */
  interests: string[];
  /**
   * Where the user says they are, as a human-readable label
   * ("Yaba, Lagos"). Distinct from GPS: this is what they typed or picked, and
   * it is what makes two areas comparable before either has shared a location.
   */
  streetName: string;
}

const EMPTY: SignupProfile = {
  displayName: '',
  age: null,
  interests: [],
  streetName: '',
};

let profile: SignupProfile = { ...EMPTY };
const listeners = new Set<() => void>();

/** The current answers. */
export function getSignupProfile(): SignupProfile {
  return profile;
}

/** Merge in what the user has typed so far. */
export function setSignupProfile(patch: Partial<SignupProfile>): void {
  const next = { ...profile, ...patch };
  // Only notify on a real change — the form re-renders constantly and a
  // subscriber woken by a no-op write would loop.
  if (
    next.displayName === profile.displayName &&
    next.age === profile.age &&
    next.streetName === profile.streetName &&
    next.interests.join('\u0000') === profile.interests.join('\u0000')
  ) {
    return;
  }

  profile = next;
  for (const listener of listeners) listener();
}

/** Forget everything. Called once the answers have been saved, and on sign-out. */
export function clearSignupProfile(): void {
  profile = { ...EMPTY };
  for (const listener of listeners) listener();
}

/**
 * True when there is anything worth sending.
 *
 * Used to skip a pointless network call for someone who filled in only an email
 * and a password — the server rejects an empty PATCH with a 400 by design.
 */
export function hasSignupProfile(): boolean {
  return Boolean(profile.displayName.trim()) || profile.age !== null || profile.interests.length > 0;
}

/** Exactly the fields the backend accepts. Omits anything the user left blank. */
export function signupProfilePayload(): {
  displayName?: string;
  age?: number;
  interests?: string[];
  streetName?: string;
} {
  const payload: { displayName?: string; age?: number; interests?: string[]; streetName?: string } = {};
  if (profile.displayName.trim()) payload.displayName = profile.displayName.trim();
  if (profile.age !== null) payload.age = profile.age;
  if (profile.interests.length > 0) payload.interests = profile.interests;
  if (profile.streetName.trim()) payload.streetName = profile.streetName.trim();
  return payload;
}

/** A stable set of interests to offer. Free text would fragment the vocabulary. */
export const INTEREST_OPTIONS = [
  'Music',
  'Football',
  'Food',
  'Gaming',
  'Movies',
  'Fitness',
  'Business',
  'Tech',
  'Art',
  'Fashion',
  'Travel',
  'Reading',
  'Photography',
  'Church',
  'Volunteering',
  'Nightlife',
] as const;

/**
 * Subscribe a component to the answers.
 *
 * `getSignupProfile` returns the same object reference until something actually
 * changes, which is what `useSyncExternalStore` requires — returning a fresh
 * object on every call would re-render forever.
 */
export function useSignupProfile(): SignupProfile {
  return useSyncExternalStore(subscribeToSignupProfile, getSignupProfile, getSignupProfile);
}

export function subscribeToSignupProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
