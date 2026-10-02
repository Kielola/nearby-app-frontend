/**
 * The reward tiers.
 *
 *     ₦2,000 for every completed block of 10 verified referrals.
 *
 * So the list reads ₦2,000 at 10, ₦2,000 again at 20, ₦2,000 again at 30, and so
 * on: each row is a *block*, not a running total. Ten of them at 50 referrals adds
 * up to ₦10,000.
 *
 * Every row is labelled with the block it represents rather than the cumulative
 * figure, because "₦2,000" next to "20 referrals" would otherwise read as a
 * second, separate ₦2,000 on top of the first — which is what it is, but only
 * because each block pays its own. The running total is shown separately at the
 * top so there is no ambiguity about what is actually owed.
 *
 * Eligibility, claim state and the limited-edition count all come from the server
 * (`GET /milestones`). The client never decides whether a user qualifies — it asks,
 * and the claim endpoint re-checks every condition before paying.
 *
 * Every tier is `autoClaim`, so the money lands the moment the threshold is
 * crossed and there is nothing for the user to tap. The claim button remains for
 * tiers that might be made manual again, and because a pay control that can refuse
 * is one the server can be the authority on.
 */
import { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { claimMilestone } from '../api';
import { formatNaira } from '../types';
import { Milestone } from '../types';
import {
  REWARD_PER_BLOCK_NGN,
  REFERRALS_PER_BLOCK,
  rewardNairaFor,
  referralsToNextBlock,
} from '../rewardsContent';
import ClaimInstructions from './ClaimInstructions';

export default function MilestonesPanel({
  milestones,
  verifiedInvites,
  isDark,
  onRefresh,
}: {
  milestones: Milestone[];
  verifiedInvites: number;
  isDark: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const claim = async (milestone: Milestone) => {
    setBusyKey(milestone.key);
    setMessage(null);
    try {
      const result = await claimMilestone(milestone.key);
      setMessage({ text: result.message, ok: true });
      await onRefresh();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not claim this reward.',
        ok: false,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const earnedSoFar = rewardNairaFor(verifiedInvites);
  const toNext = referralsToNextBlock(verifiedInvites);

  return (
    <div className="space-y-4">
      {/* How the reward works, stated before the tiers.
          The tiers alone are ambiguous: ten rows all reading ₦2,000 looks like a
          mistake until you know each one is a separate block. */}
      <div
        className={`border rounded-[24px] p-5 shadow-sm ${
          isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
        }`}
      >
        <h3 className="text-sm font-black mb-2">How your reward works</h3>
        <p className="text-[11.5px] leading-relaxed text-neutral-400">
          You earn{' '}
          <span className="font-bold text-emerald-500">
            ₦{REWARD_PER_BLOCK_NGN.toLocaleString('en-NG')}
          </span>{' '}
          for every{' '}
          <span className="font-bold text-neutral-200 dark:text-neutral-200">
            {REFERRALS_PER_BLOCK} verified referrals
          </span>
          . It keeps paying — 20 referrals is two blocks, 50 is five — and it stacks on top of the
          monthly Area vs Area challenge.
        </p>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-neutral-500 font-bold">
              Earned so far
            </p>
            <p className="text-2xl font-black text-emerald-500">
              {formatNaira(earnedSoFar * 100)}
            </p>
          </div>
          <p className="text-[10.5px] text-neutral-400 font-medium text-right pb-1">
            {verifiedInvites} verified ·{' '}
            {verifiedInvites % REFERRALS_PER_BLOCK === 0 && verifiedInvites > 0
              ? 'block complete'
              : `${toNext} to your next ₦${REWARD_PER_BLOCK_NGN.toLocaleString('en-NG')}`}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs font-bold ${
            message.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
          }`}
        >
          {message.text}
        </div>
      )}

      {milestones.map((milestone) => {
        const remaining = Math.max(0, milestone.invitesRequired - verifiedInvites);
        const progress = Math.min(100, Math.round((verifiedInvites / milestone.invitesRequired) * 100));
        const canClaim = milestone.eligible && !milestone.claimed && !milestone.soldOut;

        return (
          <div
            key={milestone.key}
            className={`border rounded-[24px] p-5 space-y-3 shadow-sm ${
              milestone.claimed
                ? isDark
                  ? 'bg-emerald-950/20 border-emerald-900/40'
                  : 'bg-emerald-50/60 border-emerald-200/60'
                : isDark
                  ? 'bg-neutral-900/40 border-neutral-800'
                  : 'bg-white border-stone-200/50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* The CUMULATIVE total by this point, not the credit for this
                    single block.
                    The server's `rewardTitle` is per-block ("₦2,000 cash reward")
                    because that is what the ledger actually credits — which meant
                    every one of the ten rows read ₦2,000, and the list looked like
                    the rate was ₦2,000 total no matter how many referrals you
                    brought. The total is what a person wants to see. */}
                <span className="text-xl font-black block text-emerald-500">
                  {formatNaira(rewardNairaFor(milestone.invitesRequired) * 100)}
                </span>
                <span className="text-[11px] text-neutral-400 font-bold block mt-0.5">
                  at {milestone.invitesRequired} verified referrals
                </span>
              </div>
              {milestone.claimed ? (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500 shrink-0">
                  <Check className="w-3.5 h-3.5" /> Claimed
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-400 shrink-0">
                  {remaining > 0 ? `${remaining} to go` : 'Ready'}
                </span>
              )}
            </div>

            <p className="text-[10px] text-neutral-400 leading-relaxed">
              This step adds {formatNaira(REWARD_PER_BLOCK_NGN * 100)} — one completed block of{' '}
              {REFERRALS_PER_BLOCK}.
            </p>

            {/* Progress bar, capped at 100% — over-achieving does not draw outside
                the bar, and the number is clamped server-side too. */}
            <div className="h-1.5 rounded-full bg-neutral-500/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${milestone.claimed ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {milestone.limitTotal !== null && (
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-neutral-500/10 text-neutral-400">
                    Limited · {Math.max(0, milestone.limitTotal - milestone.claimedGlobalCount)} left
                  </span>
                )}
                {milestone.valueKobo > 0 && (
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                    +{formatNaira(milestone.valueKobo)} this step
                  </span>
                )}
              </div>

              {!milestone.claimed && (
                <button
                  disabled={!canClaim || busyKey === milestone.key}
                  onClick={() => void claim(milestone)}
                  className={`text-[11px] font-black px-4 py-2 rounded-xl transition shrink-0 flex items-center gap-1.5 ${
                    canClaim
                      ? 'bg-amber-500 text-white active:scale-[0.98]'
                      : 'bg-neutral-500/10 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  {!milestone.eligible && <Lock className="w-3 h-3" />}
                  {busyKey === milestone.key
                    ? 'Claiming…'
                    : milestone.soldOut
                      ? 'Sold out'
                      : milestone.eligible
                        ? 'Claim reward'
                        : 'Locked'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Claiming lives here as well as on the Area tab. It used to be on the Area
          tab only, which meant someone who earned the referral reward had nothing
          on this screen telling them there was anything to do about it. */}
      <ClaimInstructions isDark={isDark} />
    </div>
  );
}
