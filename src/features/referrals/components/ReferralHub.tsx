import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Gift, Trophy, Swords, Sparkles, Wallet } from 'lucide-react';
import { useReferralProgram } from '../hooks/useReferralProgram';
import { formatNaira } from '../types';
import ReferralOverviewPanel from './ReferralOverviewPanel';
import MilestonesPanel from './MilestonesPanel';
import EarningsPanel from './EarningsPanel';
import LeaderboardPanel from './LeaderboardPanel';
import AreaChallengePanel from './AreaChallengePanel';

/**
 * The tabs, which are now exactly the rewards that exist.
 *
 * ## What was removed, and why it had to be
 *
 * There were seven tabs. Three of them — Squads, Treasure and Creators — advertised
 * prizes that are not part of the reward scheme: squads "share a prize pool",
 * treasure codes carried prizes, and creators were offered "₦100 for every verified
 * referral". None of that existed on the server, and the creator rate actively
 * contradicted the real one.
 *
 * Advertising a prize nobody can win is the same class of problem as showing a
 * venue that does not exist: a user does the work, finds nothing, and stops
 * trusting everything else the app says. Deleting them was better than leaving them
 * disabled, because a greyed-out tab still implies the feature is coming.
 *
 * What remains is what actually pays out:
 *   Invite   — your code, your link, your numbers
 *   Rewards  — the ₦2,000 per 10 referral tiers
 *   Area     — the monthly Area vs Area challenge
 *   Earnings — your balance and withdrawals
 *   Leaders  — the referral leaderboard
 */
type Tab = 'overview' | 'milestones' | 'area' | 'earnings' | 'leaders';

const TABS: { id: Tab; label: string; icon: typeof Gift }[] = [
  { id: 'overview', label: 'Invite', icon: Gift },
  { id: 'milestones', label: 'Rewards', icon: Sparkles },
  { id: 'area', label: 'Area', icon: Swords },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'leaders', label: 'Leaders', icon: Trophy },
];

/**
 * The referral programme hub.
 *
 * Self-contained: it owns its own data (`useReferralProgram`) and its own tab
 * state, and receives only `onBack` and `theme` from the host screen. That is
 * deliberate — the surrounding settings screen is already over a thousand lines,
 * and threading referral state through it would be the same mistake in a new
 * place.
 *
 * Every panel is a separate component reading from the same hook, so the balance
 * shown on the earnings tab and the balance shown on the overview tab are the
 * same value from the same fetch.
 */
export default function ReferralHub({ onBack, theme }: { onBack: () => void; theme: 'dark' | 'light' }) {
  const program = useReferralProgram(true);
  const [tab, setTab] = useState<Tab>('overview');
  const isDark = theme === 'dark';

  const card = `border rounded-[24px] shadow-sm ${isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-stone-200/50'}`;

  if (program.loading) {
    return (
      <div className="space-y-6 text-left">
        <BackButton onBack={onBack} />
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span className="text-xs text-neutral-400 font-medium">Loading your rewards…</span>
        </div>
      </div>
    );
  }

  if (program.error || !program.profile) {
    return (
      <div className="space-y-6 text-left">
        <BackButton onBack={onBack} />
        <div className={`${card} p-6 space-y-3`}>
          <span className="text-sm font-bold block">We couldn't load your rewards</span>
          <p className="text-xs text-neutral-400">{program.error ?? 'Something went wrong.'}</p>
          <button
            onClick={() => void program.refresh()}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-amber-500 text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { profile } = program;

  return (
    <div className="space-y-5 text-left pb-8">
      <BackButton onBack={onBack} />

      {/* Header: the two numbers that matter, at the top, always. */}
      <div className={`${card} p-5 space-y-4`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Nearby Rewards</h2>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              Invite friends, earn real rewards.
            </p>
          </div>
          {profile.isAmbassador && (
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500">
              Ambassador
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Verified" value={String(profile.verifiedInvites)} />
          <Stat label="Pending" value={String(profile.pendingInvites)} />
          <Stat label="Balance" value={formatNaira(profile.balanceKobo)} />
        </div>

        {profile.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {profile.badges.map((badge) => (
              <span
                key={badge.id}
                title={badge.description}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400"
              >
                {badge.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tab strip — horizontally scrollable, because seven labels do not fit on
          a 360px phone and a wrapped row shifts the whole page. */}
      <div className="-mx-1 overflow-x-auto">
        <div className="flex gap-1.5 px-1 pb-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition ${
                  active
                    ? 'bg-amber-500 text-white'
                    : isDark
                      ? 'bg-neutral-900/60 text-neutral-400'
                      : 'bg-stone-100 text-stone-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {tab === 'overview' && (
          <ReferralOverviewPanel
            profile={profile}
            referrals={program.referrals}
            analytics={program.analytics}
            isDark={isDark}
            onRefresh={program.refresh}
          />
        )}
        {tab === 'milestones' && (
          <MilestonesPanel
            milestones={program.milestones}
            verifiedInvites={profile.verifiedInvites}
            isDark={isDark}
            onRefresh={program.refresh}
          />
        )}
        {tab === 'earnings' && (
          <EarningsPanel
            balance={program.balance}
            history={program.history}
            payouts={program.payouts}
            isDark={isDark}
            onRefresh={program.refresh}
          />
        )}
        {tab === 'area' && (
          <AreaChallengePanel
            isDark={isDark}
            verifiedInvites={profile.verifiedInvites}
            areaName={profile.areaName}
          />
        )}
        {tab === 'leaders' && <LeaderboardPanel boards={program.boards} isDark={isDark} />}
      </motion.div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center space-x-1.5 text-stone-500 hover:text-stone-800 dark:text-neutral-400 dark:hover:text-white text-xs font-bold py-1 select-none"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Back to Settings</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-500/5 px-3 py-2.5">
      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide block">
        {label}
      </span>
      <span className="text-sm font-black block mt-0.5 truncate">{value}</span>
    </div>
  );
}
