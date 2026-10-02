/**
 * How to claim a reward — shown wherever a reward is described.
 *
 * Extracted so the Rewards tab and the Area tab say exactly the same thing. They
 * previously disagreed: only the Area tab explained how to claim, so a user who
 * earned the ₦2,000-per-ten referral reward had no idea there was anything to do,
 * or where to send it.
 *
 * If the steps change, they change here and both tabs follow.
 */
import { Send, ExternalLink } from 'lucide-react';
import {
  CLAIM_STEPS,
  CLAIM_FALLBACK_EMAIL,
  configuredSocialAccounts,
} from '../rewardsContent';

export default function ClaimInstructions({
  isDark,
  title = 'How to claim your reward',
}: {
  isDark: boolean;
  title?: string;
}) {
  const card = `border rounded-[24px] p-5 shadow-sm ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;
  const accounts = configuredSocialAccounts();

  return (
    <div className={card}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Send className="w-4 h-4 text-emerald-500" />
        </div>
        <h3 className="text-sm font-black">{title}</h3>
      </div>

      <ol className="space-y-4">
        {CLAIM_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold leading-snug">{step.title}</p>
              <p className="text-[10.5px] text-neutral-400 leading-relaxed mt-1">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Where to send it.
          The steps say "send it to our DM" — this is the part that makes that
          actionable, because "our DM" is not a destination until it has a handle
          attached. The handle is printed as text as well as linked, so there is no
          ambiguity about which account is ours. */}
      <div className="mt-5 pt-4 border-t border-neutral-500/10">
        <p className="text-[10px] uppercase tracking-wide text-neutral-500 font-bold mb-3">
          Send your claim to
        </p>

        {accounts.length > 0 ? (
          <div className="space-y-2">
            {accounts.map((account) => (
              <a
                key={account.platform}
                href={account.url}
                target="_blank"
                rel="noreferrer noopener"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isDark ? 'bg-neutral-950/60 hover:bg-neutral-950' : 'bg-stone-100 hover:bg-stone-200/70'
                }`}
              >
                <span className="text-[11.5px] font-bold w-[68px] shrink-0">{account.platform}</span>
                <span className="text-[11.5px] font-mono font-bold text-emerald-500 truncate flex-1 min-w-0">
                  @{account.handle}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              </a>
            ))}
            <p className="text-[10px] leading-relaxed text-neutral-400 pt-1">
              {accounts[0].howToClaim}
            </p>
          </div>
        ) : (
          <p className="text-[10.5px] leading-relaxed text-neutral-400">
            Message us at{' '}
            <span className="font-mono font-bold text-emerald-500">{CLAIM_FALLBACK_EMAIL}</span> with
            both screenshots.
          </p>
        )}
      </div>
    </div>
  );
}
