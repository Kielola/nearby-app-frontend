/**
 * Invite tab: the code, the link, the funnel, and the list of people you
 * brought in.
 *
 * The funnel figures come straight from the server (`/referrals/analytics`). The
 * old app computed a "clicks" number in the browser and then overwrote it with
 * `Math.max(clicks, verified + installs)` when it looked too small — a
 * fabricated statistic shown to users as their own performance. Nothing here is
 * derived, estimated, or repaired client-side.
 */
import { useState } from 'react';
import { Copy, Check, Share2, Users } from 'lucide-react';
import { formatNaira } from '../types';
import { ReferralAnalytics, ReferralProfile, ReferralRow } from '../types';

export default function ReferralOverviewPanel({
  profile,
  referrals,
  analytics,
  isDark,
  onRefresh,
}: {
  profile: ReferralProfile;
  referrals: ReferralRow[];
  analytics: ReferralAnalytics | null;
  isDark: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copy = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard blocked (insecure context or denied permission) — the code is
      // on screen and selectable, so nothing is hidden from the user.
    }
  };

  const share = async () => {
    const text = `Join me on Nearby — the app that shows who's around you. Use my code ${profile.referralCode} or this link: ${profile.referralLink}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join Nearby', text, url: profile.referralLink });
        return;
      }
      await copy(text, 'link');
    } catch {
      // User dismissed the share sheet — not an error.
    }
  };

  const card = `border rounded-[24px] p-5 shadow-sm space-y-4 ${
    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'
  }`;

  return (
    <div className="space-y-4">
      {/* The code itself, front and centre. */}
      <div className={card}>
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
            Your referral code
          </span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-[0.15em]">{profile.referralCode}</span>
            <button
              onClick={() => void copy(profile.referralCode, 'code')}
              className="p-2 rounded-xl bg-amber-500/10 text-amber-500"
              aria-label="Copy referral code"
            >
              {copied === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          onClick={() => void share()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 text-white text-xs font-black active:scale-[0.99] transition"
        >
          {copied === 'link' ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          Share your invite link
        </button>

        <div className="flex items-center justify-between text-[10px] text-neutral-400">
          <span className="truncate">{profile.referralLink}</span>
          <button onClick={() => void copy(profile.referralLink, 'link')} className="font-bold shrink-0 ml-2">
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      {/* Funnel. */}
      {analytics && (
        <div className={card}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black">Your funnel</span>
            <button
              onClick={() => void onRefresh()}
              className="text-[10px] font-bold text-neutral-400"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Clicks', value: analytics.clicks },
              { label: 'Signups', value: analytics.successfulRegistrations },
              { label: 'Verified', value: analytics.verifiedReferrals },
              { label: 'Rate', value: `${analytics.conversionRate}%` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-neutral-500/5 px-2 py-2.5">
                <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wide block">
                  {item.label}
                </span>
                <span className="text-sm font-black block mt-0.5">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            A referral counts once the person you invited accepts the terms and completes their
            profile — not the moment they sign up. That keeps fake accounts from paying out.
          </p>
        </div>
      )}

      {/* Badges earned. */}
      {profile.badges.length > 0 && (
        <div className={card}>
          <span className="text-xs font-black block">Your badges</span>
          <div className="space-y-2">
            {profile.badges.map((badge) => (
              <div key={badge.id} className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <span className="text-xs">★</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold block">{badge.name}</span>
                  <span className="text-[10px] text-neutral-400 block">{badge.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Who you brought in. */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-black">People you invited</span>
          <span className="text-[10px] text-neutral-400 ml-auto">{referrals.length}</span>
        </div>

        {referrals.length === 0 ? (
          <p className="text-xs text-neutral-400 py-3">
            No invites yet. Share your link — the first five verified invites unlock a month of
            Premium.
          </p>
        ) : (
          <div className="space-y-2">
            {referrals.slice(0, 25).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold block truncate">
                    {row.referredUserName}
                  </span>
                  <span className="text-[10px] text-neutral-400 block truncate">
                    {row.step}
                    {row.retentionRatePercent > 0 ? ` · ${row.retentionRatePercent}% active` : ''}
                  </span>
                </div>
                <StatusPill status={row.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {profile.lifetimeEarnedKobo > 0 && (
        <p className="text-[10px] text-neutral-400 text-center">
          Lifetime earned: {formatNaira(profile.lifetimeEarnedKobo)}
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ReferralRow['status'] }) {
  const styles: Record<ReferralRow['status'], string> = {
    verified: 'bg-emerald-500/10 text-emerald-500',
    pending: 'bg-amber-500/10 text-amber-500',
    fraudulent: 'bg-rose-500/10 text-rose-500',
  };
  const labels: Record<ReferralRow['status'], string> = {
    verified: 'Verified',
    pending: 'Pending',
    fraudulent: 'Rejected',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
