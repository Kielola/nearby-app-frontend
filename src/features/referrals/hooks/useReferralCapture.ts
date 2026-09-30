import { useCallback, useEffect, useRef, useState } from 'react';
import { logReferralClick, attributeReferral, qualifyReferral } from '../api';
import {
  readPendingReferralCode,
  writePendingReferralCode,
  subscribeToPendingReferralCode,
  referralCodeFromUrl,
} from '../pendingCode';

/**
 * Reads `?ref=CODE` from the URL, remembers it, and attributes it once the
 * visitor becomes a user.
 *
 * ## Why the code is stored rather than sent immediately
 *
 * Someone clicking an invite link is usually not signed in — often they do not
 * have an account at all. The attribution has to survive the whole signup flow
 * (possibly a page reload, possibly a verification email), so the code goes into
 * `localStorage` first and is submitted only after an account exists.
 *
 * ## Where the code can come from
 *
 * Three places, all funnelled through `pendingCode.ts`:
 *
 *   - the invite link's `?ref=` parameter
 *   - the legacy `?referral=` parameter
 *   - the referral field on the sign-up form, typed or pasted by the user
 *
 * The hook subscribes to that store, so a code entered in the form reaches
 * attribution without a reload. The form and the hook never talk directly.
 *
 * ## What the client is allowed to claim
 *
 * The code and nothing else. It does not decide that a referral happened, does
 * not count anything, and cannot name a referrer — the server resolves the code,
 * checks the referred user is real and not the referrer themselves, and the
 * `UNIQUE (referred_user_id)` constraint makes a second attribution impossible
 * even if this hook runs twice.
 */
export function useReferralCapture(isSignedIn: boolean) {
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const attributedRef = useRef(false);

  // Read the code out of the URL on mount, then keep in step with the store.
  // Runs once per page load for the URL part; the subscription covers later edits.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const href = window.location.href;
      const clean = referralCodeFromUrl(href);

      if (clean) {
        // Writes through the shared store, which notifies the subscription
        // below — so there is one code path into state, not two.
        writePendingReferralCode(clean);

        // Fire-and-forget click tracking. Deliberately allowed to fail — a
        // visitor must never see an error because an analytics insert failed.
        void logReferralClick(clean).catch(() => undefined);

        // Tidy the URL so a refresh, a screenshot or a forwarded address does not
        // resend it. `/join/CODE` is rewritten to the app root; query parameters
        // are dropped. Either way the code is already safely in the store.
        try {
          const url = new URL(href);
          url.searchParams.delete('ref');
          url.searchParams.delete('referral');
          if (/\/join\//i.test(url.pathname)) url.pathname = '/';
          window.history.replaceState({}, '', url.toString());
        } catch {
          // Non-standard URL: leaving it alone is harmless, the code is stored.
        }
      }
    } catch {
      // Blocked storage: fall through to the store read below.
    }

    // Seed immediately, then follow every later change (form edits, other tabs).
    setPendingCode(readPendingReferralCode());
    return subscribeToPendingReferralCode(setPendingCode);
  }, []);

  /**
   * Attribute, then clear. Called once the user is signed in.
   *
   * `attributedRef` guards against a re-render or a second effect run in the
   * same session doing the work twice. The server would refuse the duplicate
   * anyway — this just avoids the pointless request.
   */
  const attribute = useCallback(async () => {
    if (!isSignedIn || !pendingCode || attributedRef.current) return;

    attributedRef.current = true;

    try {
      const result = await attributeReferral(pendingCode);
      // Clear either way: a refusal means the code was bad, already used, or
      // belonged to this same user, and none of those improve on a retry.
      writePendingReferralCode(null);
      setPendingCode(null);

      if (!result.attributed) return;

      // A brand-new referral is pending until this user qualifies. Try
      // immediately — onboarding may already be complete for a returning user —
      // and again whenever they finish onboarding (the caller re-invokes this).
      await qualifyReferral().catch(() => undefined);
    } catch {
      // Network failure: leave the code in place so the next session can retry.
      attributedRef.current = false;
    }
  }, [isSignedIn, pendingCode]);

  useEffect(() => {
    void attribute();
  }, [attribute]);

  /** Promote this user's own referral from pending to verified, once it is
   *  eligible. Safe to call whenever: the server is the one that decides. */
  const qualify = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      await qualifyReferral();
    } catch {
      // Non-fatal — the next session tries again.
    }
  }, [isSignedIn]);

  /**
   * Try once per session, unconditionally.
   *
   * A referral qualifies only when the invited person has accepted the terms and
   * has a display name. Someone who signs up and sets their name an hour later
   * would otherwise stay permanently pending, because the code that brought them
   * in is consumed the moment it is attributed and nothing would prompt a retry.
   * The check is a single indexed lookup server-side when there is nothing to do.
   */
  useEffect(() => {
    void qualify();
  }, [qualify]);

  return { pendingCode, qualify };
}
