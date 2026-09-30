/**
 * The referral programme's API surface.
 *
 * Every call goes through the shared `apiRequest`, which attaches the Firebase
 * ID token — so there is exactly one auth path in the app, and these functions
 * never see or handle a token themselves.
 *
 * Note what is absent: any function that takes a balance, an invite count, or a
 * "this user is eligible" flag. The client asks for things and the server
 * decides; nothing here can assert a fact about money.
 */
// ── Referrals ───────────────────────────────────────────────────────────────
import { apiRequest } from '../../lib/api/httpClient';
import { BalanceSummary, Influencer, LedgerEntry, LeaderboardBoards, LeaderboardPeriod, Milestone, MyRank, Payout, ReferralAnalytics, ReferralProfile, ReferralRow, Team, TreasureCode } from './types';

export const getReferralProfile = () => apiRequest<ReferralProfile>('/referrals/me');
export const getReferrals = () => apiRequest<ReferralRow[]>('/referrals/list');
export const getReferralAnalytics = () => apiRequest<ReferralAnalytics>('/referrals/analytics');

/** Public — works before the visitor has an account, for link-click analytics. */
export const logReferralClick = (code: string) =>
  apiRequest<{ ok: boolean }>('/referrals/click', { method: 'POST', body: { code } });

/** Called once, right after signup, with the code captured from the invite link. */
export const attributeReferral = (code: string, deviceHash?: string) =>
  apiRequest<{ attributed: boolean; reason?: string }>('/referrals/attribute', {
    method: 'POST',
    body: { code, deviceHash },
  });

/** Called after onboarding. A no-op server-side unless this user's referral is
 *  still pending and they now qualify. */
export const qualifyReferral = () =>
  apiRequest<{ qualified: boolean; reason?: string }>('/referrals/qualify', { method: 'POST' });

// ── Ledger ──────────────────────────────────────────────────────────────────

export const getBalance = () => apiRequest<BalanceSummary>('/ledger/balance');
export const getLedgerHistory = (limit = 50) =>
  apiRequest<LedgerEntry[]>('/ledger/history', { query: { limit } });

// ── Milestones ──────────────────────────────────────────────────────────────

export const getMilestones = () => apiRequest<Milestone[]>('/milestones');
export const claimMilestone = (milestoneKey: string) =>
  apiRequest<{ success: boolean; message: string; valueKobo: number }>('/milestones/claim', {
    method: 'POST',
    body: { milestoneKey },
  });

// ── Leaderboards ────────────────────────────────────────────────────────────

export const getLeaderboards = (limit = 50) =>
  apiRequest<LeaderboardBoards>('/leaderboard', { query: { limit } });

export const getMyRank = (period: LeaderboardPeriod) =>
  apiRequest<MyRank>(`/leaderboard/${period}/me`);

// ── Teams ───────────────────────────────────────────────────────────────────

export const getTeams = () => apiRequest<Team[]>('/teams');
export const getMyTeam = () => apiRequest<Team | null>('/teams/mine');
export const createTeam = (name: string) =>
  apiRequest<{ success: boolean; message: string; team: Team }>('/teams', {
    method: 'POST',
    body: { name },
  });
export const joinTeam = (code: string) =>
  apiRequest<{ success: boolean; message: string; team: Team }>('/teams/join', {
    method: 'POST',
    body: { code },
  });
export const leaveTeam = () =>
  apiRequest<{ ok: boolean; message: string }>('/teams/leave', { method: 'POST' });

// ── Treasure hunt ───────────────────────────────────────────────────────────

export const getTreasureCodes = () => apiRequest<TreasureCode[]>('/treasure');

export const redeemTreasureCode = (code: string) =>
  apiRequest<{ success: boolean; message: string; prizeKobo: number }>('/treasure/redeem', {
    method: 'POST',
    body: { code },
  });

/** Redeem with a location attached, so the server can verify proximity when the
 *  code is pinned to a campus. Used when the browser can supply a fix. */
export const redeemTreasureCodeWithLocation = (code: string) =>
  new Promise<{ success: boolean; message: string; prizeKobo: number }>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(redeemTreasureCode(code));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve(
          apiRequest<{ success: boolean; message: string; prizeKobo: number }>('/treasure/redeem', {
            method: 'POST',
            body: {
              code,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          }),
        ),
      // No fix, or permission refused — send the redeem anyway. The server
      // treats a missing location as "skip the proximity check" rather than
      // "fail", so a member with location problems can still claim a code they
      // physically found.
      () => resolve(redeemTreasureCode(code)),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });

// ── Influencers ─────────────────────────────────────────────────────────────

export const getInfluencers = () => apiRequest<Influencer[]>('/influencers');
export const getMyInfluencerApplication = () => apiRequest<Influencer | null>('/influencers/mine');

export const applyAsInfluencer = (input: {
  instagram?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
  customCode: string;
  campaignName: string;
}) =>
  apiRequest<{ success: boolean; message: string }>('/influencers/apply', {
    method: 'POST',
    body: input,
  });

// ── Payouts ─────────────────────────────────────────────────────────────────

export const getMyPayouts = () => apiRequest<Payout[]>('/payouts/mine');

export const requestPayout = (input: {
  amountKobo?: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  idempotencyKey: string;
}) =>
  apiRequest<{ success: boolean; message: string; payoutId: string }>('/payouts', {
    method: 'POST',
    body: input,
  });

export const setPayoutSocialTag = (payoutId: string, handle: string) =>
  apiRequest<{ success: boolean; message: string }>(`/payouts/${payoutId}/social-tag`, {
    method: 'POST',
    body: { handle },
  });
