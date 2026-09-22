import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Video, Sparkles, X } from 'lucide-react';
import {
  subscribeToCallComingSoon,
  CALL_COMING_SOON_TITLE,
  CALL_COMING_SOON_BODY,
} from '../callAvailability';

/**
 * The "calls are coming soon" notice.
 *
 * Rendered once at the composition root (NearbyAppView) and driven by the
 * module-level signal in `callAvailability.ts`, so every call button anywhere in
 * the app raises it without any component needing to know about it.
 *
 * It dismisses itself after a few seconds as well as on tap, so it can never
 * strand a user behind a modal if something goes wrong above it in the tree.
 */
export default function CallComingSoonModal() {
  const [kind, setKind] = useState<'audio' | 'video' | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const dismiss = () => {
    clearTimer();
    setKind(null);
  };

  useEffect(() => {
    const unsubscribe = subscribeToCallComingSoon((nextKind) => {
      clearTimer();
      setKind(nextKind);
      // Auto-dismiss. The message is informational, not a decision to make.
      timerRef.current = window.setTimeout(() => setKind(null), 9000);
    });

    return () => {
      unsubscribe();
      clearTimer();
    };
  }, []);

  const Icon = kind === 'video' ? Video : Phone;

  return (
    <AnimatePresence>
      {kind !== null && (
        <motion.div
          key="call-coming-soon"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
          // z-[70] sits above the call screen (z-50) and every other overlay, so
          // the notice is never hidden behind something it was triggered from.
          className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          role="dialog"
          aria-modal="true"
          aria-label={CALL_COMING_SOON_TITLE}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            // Stop the card's own clicks from bubbling to the backdrop dismiss,
            // so tapping the text does not close it accidentally.
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F1115] p-7 text-center shadow-2xl"
          >
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white/80"
            >
              <X size={16} />
            </button>

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/25 to-sky-500/25 ring-1 ring-white/15">
              <Icon size={28} className="text-emerald-300" />
            </div>

            <div className="mb-2 flex items-center justify-center gap-2">
              <Sparkles size={14} className="text-emerald-300" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
                Coming soon
              </span>
              <Sparkles size={14} className="text-emerald-300" />
            </div>

            <h2 className="mb-3 text-lg font-semibold leading-snug text-white">
              {CALL_COMING_SOON_TITLE}
            </h2>

            <p className="mb-6 text-sm leading-relaxed text-white/60">
              {CALL_COMING_SOON_BODY}
            </p>

            <button
              onClick={dismiss}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-3 text-sm font-semibold text-[#04110c] transition active:scale-[0.98]"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
