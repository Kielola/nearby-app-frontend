import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';

/**
 * The onboarding wizard's form state
 *
 * What the user has typed or picked so far in the sign-up wizard. Only the wizard reads and writes these, so they need no dependencies either.
 *
 * ## Dependency interface
 *
 * 0 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseOnboardingStateDeps {

}

export function useOnboardingState() {
  /**
   * Starts null on purpose: the wizard must obtain a real fix before it can
   * finish, so seeding it with hard-coded coordinates only invites a user to
   * complete sign-up with someone else's location attached.
   */
  const [onboardingCoords, setOnboardingCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [onboardingAddress, setOnboardingAddress] = useState<string>('Oketunji Street, Osogbo, Osun State');
    const [onboardingState, setOnboardingState] = useState<string>('Osun');
    const [onboardingStreetName, setOnboardingStreetName] = useState<string>('Oketunji Street');

  // ── moved from src/app/hooks/useNearbyController.ts lines 551-559 ──

    const [onboardingStep, setOnboardingStep] = useState<number>(1);
    const [onboardingName, setOnboardingName] = useState<string>('');
    const [onboardingUsername, setOnboardingUsername] = useState<string>('');
    const [onboardingBio, setOnboardingBio] = useState<string>('Hey, I am a new neighbor around! Let\'s connect! 👋');
    const [onboardingPhoto, setOnboardingPhoto] = useState<string | null>(null);
    const [onboardingAgeRange, setOnboardingAgeRange] = useState<string>('25-34');
    const [onboardingGender, setOnboardingGender] = useState<string>('Male');
    const [onboardingInterests, setOnboardingInterests] = useState<string[]>(['Tech', 'Music']);
    const [onboardingCommunities, setOnboardingCommunities] = useState<string[]>(['comm-1']);

  // ── moved from src/app/hooks/useNearbyController.ts lines 589-590 ──

    const [onboardingGpsStatus, setOnboardingGpsStatus] = useState<'pending' | 'success' | 'failed'>('pending');
    const [onboardingCamStatus, setOnboardingCamStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  return {
    onboardingAddress,
    onboardingAgeRange,
    onboardingBio,
    onboardingCamStatus,
    onboardingCommunities,
    onboardingCoords,
    onboardingGender,
    onboardingGpsStatus,
    onboardingInterests,
    onboardingName,
    onboardingPhoto,
    onboardingState,
    onboardingStep,
    onboardingStreetName,
    onboardingUsername,
    setOnboardingAddress,
    setOnboardingAgeRange,
    setOnboardingBio,
    setOnboardingCamStatus,
    setOnboardingCommunities,
    setOnboardingCoords,
    setOnboardingGender,
    setOnboardingGpsStatus,
    setOnboardingInterests,
    setOnboardingName,
    setOnboardingPhoto,
    setOnboardingState,
    setOnboardingStep,
    setOnboardingStreetName,
    setOnboardingUsername,
  };
}
