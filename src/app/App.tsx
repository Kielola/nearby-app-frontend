import { useEffect, useState, type ReactNode } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { onAuthStateChanged } from 'firebase/auth';
import { useNearbyController } from './hooks/useNearbyController';
import { NearbyRuntimeProvider } from './context/NearbyRuntimeContext';
import SplashScreen from './components/SplashScreen';
import AuthGate from './components/AuthGate';
import BannedScreen from './components/BannedScreen';
import NearbyAppView from './components/NearbyAppView';
import ReferralCapture from '../features/referrals/components/ReferralCapture';
import VerifyEmailGate from '../features/authentication/components/VerifyEmailGate';
import { verificationRequiredFor } from '../features/authentication/services/verificationGate';
import { auth } from '../firebase';

const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof process !== 'undefined' ? process.env?.GOOGLE_MAPS_PLATFORM_KEY : '') ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

/**
 * Holds the app back until the signed-in user has confirmed their email.
 *
 * ## Why this is a boundary and not a check inside the screens
 *
 * Verification has to be unskippable to mean anything. Putting the check in each
 * screen would mean a new screen can forget it, and one missed branch is a way
 * around the requirement. This sits directly above the app, so nothing renders
 * until it passes.
 *
 * ## Why it re-derives on auth change
 *
 * `verified` is seeded from whoever is signed in right now, then recomputed every
 * time the auth state changes. Without that, signing out of a verified account and
 * into an unverified one in the same tab would inherit the stale `true` and walk
 * straight past the gate.
 *
 * ## Why it re-checks when the tab regains focus
 *
 * The common path is: user leaves to open their mail client, clicks the link,
 * comes back. Reloading on focus means the gate usually resolves before they have
 * even looked at the screen — the polling inside `VerifyEmailGate` is the
 * belt-and-braces case for when focus events are unreliable.
 */
function EmailVerificationBoundary({ children }: { children: ReactNode }) {
  const [verified, setVerified] = useState<boolean>(
    () => !verificationRequiredFor(auth.currentUser),
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setVerified(!verificationRequiredFor(user));
    });
    return unsubscribe;
  }, []);

  if (!verified) return <VerifyEmailGate onVerified={() => setVerified(true)} />;
  return <>{children}</>;
}

export default function App() {
  const runtime = useNearbyController();

  const content = (
    <NearbyRuntimeProvider value={runtime}>
      {/* Mounted OUTSIDE the auth branch, so ?ref=CODE is read and remembered
          on the landing/onboarding screens where an invited visitor actually
          lands. Inside NearbyAppView it would only run after sign-in, by which
          point the invite link has already been left. Renders nothing. */}
      <ReferralCapture />
      {runtime.isSplashActive || runtime.authLoading ? (
        <SplashScreen />
      ) : !runtime.currentUser ? (
        <AuthGate />
      ) : runtime.isCurrentMeBanned ? (
        // Banned takes precedence over verification: telling a banned user to
        // confirm their email would imply that doing so gets them back in.
        <BannedScreen />
      ) : (
        <EmailVerificationBoundary>
          <NearbyAppView />
        </EmailVerificationBoundary>
      )}
    </NearbyRuntimeProvider>
  );

  if (runtime.usingGoogleMaps) {
    return (
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
        {content}
      </APIProvider>
    );
  }

  return content;
}
