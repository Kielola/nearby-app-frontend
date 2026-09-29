import { useNearbyRuntime } from '../../../app/context/NearbyRuntimeContext';
import { useReferralCapture } from '../hooks/useReferralCapture';

/**
 * Invisible. Mounted once, near the root, so invite-link handling works no
 * matter which screen the visitor lands on — including the landing and
 * onboarding screens, which is where invitees actually arrive.
 *
 * Renders nothing: it exists to run `useReferralCapture` exactly once per page
 * load. Mounting it here rather than inside the referral hub matters, because
 * the hub is only reachable after sign-in and by then the code in the URL is
 * long gone.
 */
export default function ReferralCapture() {
  const { currentUser } = useNearbyRuntime();
  useReferralCapture(Boolean(currentUser));
  return null;
}
