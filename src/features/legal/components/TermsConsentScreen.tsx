import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FINAL_SECTION_NUMBER,
  TERMS_ARE_PLACEHOLDER,
  TERMS_BODY,
  TERMS_EFFECTIVE_DATE,
  TERMS_GOVERNING_LAW,
  TERMS_LAST_UPDATED,
  TERMS_SITE,
  parseTermsSections,
  unfilledTermsPlaceholders,
  type TermsSection,
} from '../content/termsOfService';

interface TermsConsentScreenProps {
  /** Called after the server has recorded agreement. */
  onAccepted: () => void;
  /** Called when the user declines. */
  onDecline: () => void;
  /** Record agreement. Resolves true once the server has it. */
  accept: () => Promise<boolean>;
  /** True while the write is in flight. */
  submitting?: boolean;
  /** Server-side failure message, if any. */
  error?: string | null;
  /** Back out without accepting or declining — returns to the form. */
  onBack?: () => void;
}

/**
 * The Terms of Service consent screen, shown before a new account is created.
 *
 * ## The two-gate design
 *
 * Agreement requires BOTH of these, and they are separate on purpose:
 *
 *   1. Scrolling to the end of the document. This establishes that the text was
 *      actually reachable — that it was displayed, not hidden behind a link.
 *   2. Ticking the box and pressing "I AGREE". This is the affirmative act.
 *
 * A single "I agree" button with the text behind a link is the pattern that
 * tends to fail scrutiny, because the user can agree without the terms ever
 * having been on screen. Requiring the scroll costs a little friction and is
 * the reason the button stays disabled until the end is reached.
 *
 * The final section carries its own acknowledgement, because the agreement
 * defines one there; it says so in its own words in the text, and this component
 * does not restate or condense it.
 */
export default function TermsConsentScreen({
  onAccepted,
  onDecline,
  accept,
  submitting = false,
  error = null,
  onBack,
}: TermsConsentScreenProps) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const sections = useMemo(() => parseTermsSections(TERMS_BODY), []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const finalSection = useMemo(
    () => sections.find((s) => s.number === String(FINAL_SECTION_NUMBER)),
    [sections],
  );

  /**
   * Section 34's own closing sentence, used verbatim as the checkbox label.
   *
   * The document's final line — "BY SELECTING "I AGREE", CREATING AN ACCOUNT OR
   * CONTINUING TO USE THE PLATFORM, YOU ACCEPT THESE TERMS." — is the operative
   * acknowledgement, so it is what the user ticks. Nothing here is rewritten;
   * there is no place for the wording to drift from the agreement.
   */
  const acknowledgementLabel = useMemo(() => {
    if (!finalSection) return 'I have read and agree to the Terms of Service.';
    const paragraphs = finalSection.body.split('\n').filter((l) => l.trim());
    const closing = paragraphs[paragraphs.length - 1] ?? '';
    return closing.trim() || finalSection.body;
  }, [finalSection]);

  /** Section 34's acknowledgements as individual lines, for the review box. */
  const acknowledgementLines = useMemo(() => {
    if (!finalSection) return [] as string[];
    return finalSection.body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== acknowledgementLabel);
  }, [finalSection, acknowledgementLabel]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 24px of slack so a device whose last line sits fractionally above the
    // fold still counts as "read to the end" rather than trapping the user.
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atEnd) setScrolledToEnd(true);
  }, []);

  // A document short enough to fit without scrolling can never fire a scroll
  // event, so the gate would be unsatisfiable. Detect that case up front.
  const handleContentMeasure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (node.scrollHeight <= node.clientHeight + 24) setScrolledToEnd(true);
  }, []);

  const canAgree = scrolledToEnd && acknowledged && !submitting && !TERMS_ARE_PLACEHOLDER;

  const handleAgree = useCallback(async () => {
    if (!canAgree) return;
    const ok = await accept();
    if (ok) onAccepted();
  }, [canAgree, accept, onAccepted]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-950">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-base font-bold text-[#161616] dark:text-neutral-100">
          Terms of Service
        </h1>
        <p className="mt-1 text-[11px] text-neutral-500">
          {TERMS_SITE} · Effective {TERMS_EFFECTIVE_DATE} · Last updated {TERMS_LAST_UPDATED}
        </p>
        <p className="mt-1 text-[11px] text-neutral-500">
          Governed by the laws of the {TERMS_GOVERNING_LAW}.
        </p>
      </div>

      {/* If the agreement body is ever missing, refuse to record agreement to
          it — a record of having accepted nothing is worse than no record. */}
      {TERMS_ARE_PLACEHOLDER && (
        <div className="shrink-0 mx-5 mt-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
          <strong className="block mb-1">Not ready to accept</strong>
          The agreement text has not been added yet. Registration is blocked until
          it is, so that nobody records agreement to an incomplete document.
          Replace <code>TERMS_BODY</code> in{' '}
          <code>src/features/legal/content/termsOfService.ts</code>.
        </div>
      )}

      {/* Unfilled contact placeholders do not block sign-up — the agreement is
          complete enough to be accepted — but they should not go unnoticed. */}
      {unfilledTermsPlaceholders().length > 0 && (
        <div className="shrink-0 mx-5 mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[10.5px] leading-relaxed text-amber-900">
          <strong>{unfilledTermsPlaceholders().length} placeholder(s) still to fill</strong> in{' '}
          <code>termsOfService.ts</code>: {unfilledTermsPlaceholders().join(', ')}
        </div>
      )}

      {/* The agreement, verbatim */}
      <div
        ref={(node) => { (scrollRef as any).current = node; handleContentMeasure(node); }}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-4 text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300"
      >
        {sections.map((section: TermsSection, i: number) => (
          <section key={`${section.number}-${i}`} className="mb-5">
            {(section.number || section.title) && (
              <h2 className="mb-1.5 text-[12px] font-bold text-[#161616] dark:text-neutral-100">
                {section.number && /^\d+$/.test(section.number) ? `${section.number}. ` : ''}
                {section.title}
              </h2>
            )}
            {/* whitespace-pre-wrap: the text is reproduced exactly as written,
                including its own paragraph breaks. Nothing is re-wrapped or
                reworded — see the note at the top of the content file. */}
            <p className="whitespace-pre-wrap">{section.body}</p>
          </section>
        ))}
        <div className="h-2" />
      </div>

      {/* Consent controls */}
      <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 px-5 py-4 space-y-3 bg-white dark:bg-neutral-950">
        {!scrolledToEnd && !TERMS_ARE_PLACEHOLDER && (
          <p className="text-[11px] text-amber-600">
            Scroll to the end of the agreement to continue.
          </p>
        )}

        {/* Section 34, laid out so it is actually read rather than scrolled past.
            This is the acknowledgement the agreement requires separately, so it
            gets its own visual weight instead of being the last screen of a long
            document. */}
        {acknowledgementLines.length > 0 && (
          <div
            className={`rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3.5 py-3 max-h-[152px] overflow-y-auto ${
              scrolledToEnd ? 'opacity-100' : 'opacity-50'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Section 34 — User acknowledgement
            </p>
            <ul className="space-y-1.5">
              {acknowledgementLines.map((line, i) => (
                <li key={i} className="flex gap-2 text-[11px] leading-snug text-neutral-700 dark:text-neutral-300">
                  <span className="text-[#0F8A5F] shrink-0">•</span>
                  <span>{line.replace(/;$/, '').replace(/\s+AND$/, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <label
          className={`flex items-start gap-3 text-[11px] leading-relaxed cursor-pointer ${
            scrolledToEnd ? 'opacity-100' : 'opacity-50 pointer-events-none'
          }`}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={!scrolledToEnd}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F8A5F]"
          />
          {/* Verbatim section 34 closing sentence. */}
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            {acknowledgementLabel}
          </span>
        </label>

        {error && (
          <p className="text-[11px] text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDecline}
            disabled={submitting}
            className="flex-1 h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 text-[12px] font-bold text-neutral-600 dark:text-neutral-300 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAgree}
            disabled={!canAgree}
            className="flex-[2] h-11 rounded-xl bg-[#0F8A5F] text-white text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Recording…' : 'I AGREE'}
          </button>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="w-full text-[11px] text-neutral-500 underline underline-offset-2"
          >
            Back to sign up
          </button>
        )}
      </div>
    </div>
  );
}
