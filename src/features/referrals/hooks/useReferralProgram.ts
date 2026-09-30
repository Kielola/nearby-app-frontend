import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api/httpClient';
import * as api from '../api';
import { BalanceSummary, Influencer, LedgerEntry, LeaderboardBoards, Milestone, Payout, ReferralAnalytics, ReferralProfile, ReferralRow, Team, TreasureCode } from '../types';

export interface ReferralProgramState {
  profile: ReferralProfile | null;
  milestones: Milestone[];
  referrals: ReferralRow[];
  analytics: ReferralAnalytics | null;
  balance: BalanceSummary | null;
  history: LedgerEntry[];
  boards: LeaderboardBoards | null;
  teams: Team[];
  myTeam: Team | null;
  treasure: TreasureCode[];
  influencers: Influencer[];
  payouts: Payout[];
  loading: boolean;
  error: string | null;
}

const EMPTY: ReferralProgramState = {
  profile: null,
  milestones: [],
  referrals: [],
  analytics: null,
  balance: null,
  history: [],
  boards: null,
  teams: [],
  myTeam: null,
  treasure: [],
  influencers: [],
  payouts: [],
  loading: true,
  error: null,
};

/**
 * Loads the whole referral programme for the signed-in user.
 *
 * One hook, one `Promise.allSettled`, one refresh function. Every panel in the
 * hub reads from this and every action calls `refresh()` — so there is no
 * component with its own private copy of the balance, which is how two screens
 * end up disagreeing about how much money a user has.
 *
 * `allSettled` rather than `all`: a single failing endpoint (say, the influencer
 * board) must not blank out the whole hub. Each panel degrades to empty and the
 * rest of the page still works.
 *
 * Nothing here caches a balance in local state after a write. After any action
 * that moves money, the server is re-read — the alternative is a client that
 * believes a number the server never agreed to.
 */
export function useReferralProgram(enabled: boolean) {
  const [state, setState] = useState<ReferralProgramState>(EMPTY);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setState((prev) => ({ ...prev, loading: prev.profile === null, error: null }));

    const results = await Promise.allSettled([
      api.getReferralProfile(),
      api.getMilestones(),
      api.getReferrals(),
      api.getReferralAnalytics(),
      api.getBalance(),
      api.getLedgerHistory(50),
      api.getLeaderboards(50),
      api.getTeams(),
      api.getMyTeam(),
      api.getTreasureCodes(),
      api.getInfluencers(),
      api.getMyPayouts(),
    ]);

    if (!mounted.current) return;

    const value = <T,>(index: number, fallback: T): T =>
      results[index].status === 'fulfilled'
        ? ((results[index] as PromiseFulfilledResult<T>).value ?? fallback)
        : fallback;

    // The one failure the user must actually see: the profile itself. If it
    // failed, the hub has nothing to show.
    const profileFailed = results[0].status === 'rejected';
    const error = profileFailed
      ? results[0].status === 'rejected' && results[0].reason instanceof ApiError
        ? results[0].reason.message
        : 'Could not load your referral programme.'
      : null;

    setState({
      profile: value<ReferralProfile | null>(0, null),
      milestones: value<Milestone[]>(1, []),
      referrals: value<ReferralRow[]>(2, []),
      analytics: value<ReferralAnalytics | null>(3, null),
      balance: value<BalanceSummary | null>(4, null),
      history: value<LedgerEntry[]>(5, []),
      boards: value<LeaderboardBoards | null>(6, null),
      teams: value<Team[]>(7, []),
      myTeam: value<Team | null>(8, null),
      treasure: value<TreasureCode[]>(9, []),
      influencers: value<Influencer[]>(10, []),
      payouts: value<Payout[]>(11, []),
      loading: false,
      error,
    });
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { ...state, refresh };
}
