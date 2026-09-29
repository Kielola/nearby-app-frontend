import { APIProvider } from '@vis.gl/react-google-maps';
import { useNearbyController } from './hooks/useNearbyController';
import { NearbyRuntimeProvider } from './context/NearbyRuntimeContext';
import SplashScreen from './components/SplashScreen';
import AuthGate from './components/AuthGate';
import BannedScreen from './components/BannedScreen';
import NearbyAppView from './components/NearbyAppView';
import ReferralCapture from '../features/referrals/components/ReferralCapture';

const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof process !== 'undefined' ? process.env?.GOOGLE_MAPS_PLATFORM_KEY : '') ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';


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
        <BannedScreen />
      ) : (
        <NearbyAppView />
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
