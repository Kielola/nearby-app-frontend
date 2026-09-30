import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mail, RefreshCw, LogOut, CheckCircle2, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { auth } from '../../../firebase';
import { webmailTargetFor } from '../services/webmail';
import { signOut } from 'firebase/auth';
import {
  sendVerificationEmail,
  refreshVerificationStatus,
} from '../services/emailVerification';

/**
 * Blocks the app until the signed-in user's email address is verified.
 *
 * ## Why this exists as its own screen
 *
 * A verification requirement is only honest if the user cannot simply ignore it.
 * A dismissible banner gets dismissed, and then the requirement is decorative.
 * So this replaces the app entirely, the way `BannedScreen` does.
 *
 * ## Why it polls instead of trusting the session
 *
 * The obvious flow is: user clicks the link in their inbox, comes back, and the
 * app notices. It does not. Firebase's local session carries the verification
 * claim from sign-in time, so a user who verified in another tab still reads as
 * unverified here until `reload()` refreshes it. Polling on a short interval is
 * what makes "I clicked the link" actually work without a manual refresh.
 *
 * The poll is deliberately gentle and stops the moment it succeeds:
 *   - every 5s while the tab is visible
 *   - immediately when the tab regains focus (the common case — they left to
 *     open their mail client and came back)
 *   - once on mount
 *
 * ## Why the manual button still exists
 *
 * Focus and polling both fail in some environments (an in-app browser, a locked
 * down webview). The button is the escape hatch, and it gives the user something
 * to do other than wait.
 */

const POLL_INTERVAL_MS = 5000;
const RESEND_COOLDOWN_SECONDS = 60;

interface Props {
  /** Called once verification is confirmed, so the app can swap itself in. */
  onVerified: () => void;
}

export default function VerifyEmailGate({ onVerified }: Props) {
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const email = auth.currentUser?.email ?? '';
  const doneRef = useRef(false);

  // ── Confirm-and-continue ────────────────────────────────────────────────
  const checkNow = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (doneRef.current) return;
      if (!opts.silent) setChecking(true);
      try {
        const verified = await refreshVerificationStatus();
        if (verified) {
          doneRef.current = true;
          onVerified();
          return;
        }
        if (!opts.silent) {
          setNotice({
            tone: 'error',
            text: "This address isn't verified yet. Open the link we emailed you, then try again.",
          });
        }
      } finally {
        if (!opts.silent) setChecking(false);
      }
    },
    [onVerified],
  );

  // ── Poll while visible, plus on focus ───────────────────────────────────
  useEffect(() => {
    void checkNow({ silent: true });

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkNow({ silent: true });
    }, POLL_INTERVAL_MS);

    const onFocus = () => void checkNow({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkNow({ silent: true });
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkNow]);

  // ── Resend cooldown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    setSending(true);
    setNotice(null);
    try {
      const result = await sendVerificationEmail();
      if (result.status === 'sent') {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setNotice({ tone: 'ok', text: `Sent again to ${email}. Check your spam folder too.` });
      } else if (result.status === 'throttled') {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setNotice({ tone: 'error', text: result.message ?? 'Please wait before requesting another.' });
      } else if (result.status === 'not-required') {
        // Should be unreachable — the gate is only mounted when verification is
        // required — but if it happens, let the user through rather than trap them.
        doneRef.current = true;
        onVerified();
      } else {
        setNotice({ tone: 'error', text: result.message ?? 'Could not send the email.' });
      }
    } finally {
      setSending(false);
    }
  }, [email, onVerified]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
    } finally {
      // The auth listener in the controller will drop us back to AuthGate.
      window.location.reload();
    }
  }, []);

  // The provider's inbox for the address they registered with, if we know it.
  // Computed on every render rather than stored: it is a pure lookup on a
  // string, and caching it in state would risk showing a stale provider if
  // the account ever changed.
  const webmail = webmailTargetFor(email);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F8F9FB] dark:bg-neutral-950">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-[440px] w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="w-full space-y-6"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#0F8A5F]/10 border border-[#0F8A5F]/20 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-[#0F8A5F]" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-[26px] font-bold text-[#161616] dark:text-neutral-100 tracking-tight">
              Confirm your email
            </h1>
            <p className="text-[14px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              We sent a verification link to
            </p>
            <p className="text-[14px] font-semibold text-[#161616] dark:text-neutral-200 break-all px-2">
              {email || 'your email address'}
            </p>
            <p className="text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400 pt-1">
              Open it and click the link. This page will continue on its own once your
              address is confirmed.
            </p>
          </div>

          {/* Notice */}
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-[14px] border px-4 py-3 text-[12.5px] leading-relaxed flex items-start gap-2.5 ${
                notice.tone === 'ok'
                  ? 'border-[#0F8A5F]/30 bg-[#0F8A5F]/8 text-[#0B6244] dark:text-[#4ADE9E]'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
              }`}
            >
              {notice.tone === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 mt-[1px] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-[1px] shrink-0" />
              )}
              <span>{notice.text}</span>
            </motion.div>
          )}

          {/* Actions */}
          <div className="space-y-[12px] pt-1">
            {/* Primary: I've verified */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => checkNow()}
              disabled={checking}
              className="w-full h-[56px] bg-[#0F8A5F] hover:bg-[#0C7A53] disabled:opacity-70 text-white rounded-[18px] text-[15px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_14px_rgba(15,138,95,0.25)]"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I've confirmed my email</span>
                </>
              )}
            </motion.button>

            {/* Secondary: open the inbox.
                This used to be `window.location.href = 'mailto:'`. A `mailto:` with
                no recipient does not open the inbox — it opens the mail client in
                COMPOSE mode, so tapping "Open my email app" produced a blank new
                message addressed to nobody. There is no web API that opens an inbox;
                linking to the provider's web inbox is the closest thing that actually
                works, because Gmail/Outlook/Yahoo/iCloud all register app links for
                their web URLs and open the native app on a phone.
                When the provider is not recognised we render nothing rather than a
                button that does the wrong thing — the guidance below still applies. */}
            {webmail && (
              <motion.a
                whileTap={{ scale: 0.98 }}
                href={webmail.url}
                target="_blank"
                rel="noreferrer noopener"
                className="w-full h-[56px] bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-800 text-[#161616] dark:text-neutral-100 rounded-[18px] text-[15px] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Mail className="w-4 h-4" />
                <span>{webmail.label}</span>
              </motion.a>
            )}

            {/* Tertiary: resend */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              className="w-full h-[48px] bg-transparent disabled:opacity-55 text-[13.5px] font-semibold text-[#0F8A5F] hover:underline transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-default disabled:no-underline"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : cooldown > 0 ? (
                <span>You can resend in {cooldown}s</span>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Didn't get it? Send again</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Help */}
          <div className="rounded-[14px] bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 px-4 py-3.5 space-y-1.5">
            <p className="text-[11.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold text-[#161616] dark:text-neutral-200">Not seeing it?</span>{' '}
              Open your email app yourself and look for a message from Nearby.{' '}
              Check your spam or promotions folder too — the sender is a Firebase address, so
              filters can be cautious with it.
            </p>
            <p className="text-[11.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Wrong address?{' '}
              <button
                type="button"
                onClick={handleSignOut}
                className="font-semibold text-[#0F8A5F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                Sign out and start again
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
