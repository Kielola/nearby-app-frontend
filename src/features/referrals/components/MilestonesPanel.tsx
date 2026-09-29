import { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { claimMilestone } from '../api';
import { formatNaira } from '../types';
import type { Milestone } from '../types';

/**
 * The five reward tiers.
 *
 * Eligibility, claim state and the limited-edition count all come from the
 * server (`GET /milestones`). The client never decides whether a user qualifies
 * — it asks, and the claim endpoint re-checks every condition before paying.
 *
 * The two auto-claimed tiers (20 and 50 invites) show as already claimed once
 * they pay, because the server claims them through the same table. That is the
 * fix for the original's double payment: those tiers were credited automatically
 * inside `recordReferral` *and* offered as manually claimable, so they could pay
 * twice. Here they pay once, whichever path reaches them first.
 */
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

  return (
    <div className="space-y-4">
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
                <span className="text-sm font-black block">
                  {milestone.invitesRequired} verified invites
                </span>
                <span className="text-[11px] text-amber-500 font-bold block mt-0.5">
                  {milestone.rewardTitle}
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

            <p className="text-[10px] text-neutral-400 leading-relaxed">{milestone.rewardDescription}</p>

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
                    {formatNaira(milestone.valueKobo)}
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
    </div>
  );
}
