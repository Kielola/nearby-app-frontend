import { Suspense, lazy, useEffect } from 'react';
import { useNearbyRuntime } from '../context/NearbyRuntimeContext';
import AppHeaderAndBanners from './AppHeaderAndBanners';
import MainTabContent from './MainTabContent';
import CameraOverlay from './CameraOverlay';
import ChatRoomOverlay from './ChatRoomOverlay';
import CallScreenOverlay from './CallScreenOverlay';
import CallComingSoonModal from '../../features/calls/components/CallComingSoonModal';
import AppModals from './AppModals';
import BottomNav from './BottomNav';
/**
 * SecondaryModals is the single largest file in the app — every modal in the
 * product, roughly 2,500 lines — and not one of them is on screen when the app
 * first loads. They are all behind a tap.
 *
 * Loading it eagerly meant every visitor paid to download, parse and execute all
 * of it before seeing anything. Deferring it moves that cost off the critical
 * path entirely.
 *
 * The fallback is `null` rather than a spinner, and that is not a shortcut: with
 * no modal open this component renders nothing anyway, so `null` is exactly what
 * would have been on screen. There is no visual difference at all.
 *
 * The prefetch below is the other half of that: it warms the chunk during idle
 * time, so by the time a user actually taps something that opens a modal, the
 * code is already downloaded and the modal appears with no delay. Deferring
 * without prefetching would just move the wait to the first tap.
 */
const SecondaryModals = lazy(() => import('./SecondaryModals'));

/** Begin downloading the deferred chunk when the browser is otherwise idle. */
function prefetchSecondaryModals() {
  void import('./SecondaryModals');
}

export default function NearbyAppView() {
  const { theme } = useNearbyRuntime();

  useEffect(() => {
    // requestIdleCallback is not in Safari until 17.4, and older iOS is exactly
    // the audience this optimisation is for — so fall back to a short timer
    // rather than assuming support.
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof w.requestIdleCallback === 'function') {
      const handle = w.requestIdleCallback(prefetchSecondaryModals, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(prefetchSecondaryModals, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#070a13]">
      <div className={`flex flex-col h-screen w-full ${theme.appBg} font-sans antialiased overflow-hidden relative transition-all duration-300`}>
        <AppHeaderAndBanners />
        <MainTabContent />
        <CameraOverlay />
        <ChatRoomOverlay />
        <CallScreenOverlay />
        {/* Rendered once, here, so every call button in the app can raise it
            without prop-drilling through the controller. */}
        <CallComingSoonModal />
        <AppModals />
        {/* Invite-link capture lives in App.tsx, above the auth branch — it has
            to run on the landing screen, before a visitor has an account. */}
        <BottomNav />
        <Suspense fallback={null}>
          <SecondaryModals />
        </Suspense>
      </div>
    </div>
  );
}
