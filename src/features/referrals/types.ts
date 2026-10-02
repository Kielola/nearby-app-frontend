/**
 * Types for the referral programme.
 *
 * Money is always **kobo** as an integer, matching the backend exactly. There is
 * deliberately no naira field anywhere in this file: the conversion happens once,
 * in `formatNaira` at render time, so no component can accidentally do
 * arithmetic on a float naira value.
 */

export type MilestoneRewardType = 'subscription' | 'cash' | 'badge' | 'swag' | 'ambassador';

export interface Milestone {
  key: string;
  invitesRequired: number;
  rewardTitle: string;
  rewardDescription: string;
  rewardType: MilestoneRewardType;
  valueKobo: number;
  badgeName: string | null;
  limitTotal: number | null;
  claimedGlobalCount: number;
  claimed: boolean;
  soldOut: boolean;
  eligible: boolean;
}

export interface ReferralProfile {
  userId: string;
  name: string;
  avatar: string;
  bio: string;
  /**
   * The area this user is competing for in the monthly Area vs Area challenge.
   * Null when the user has not set one — the challenge screen says so rather than
   * guessing a location.
   */
  areaName: string | null;
  referralCode: string;
  referralLink: string;
  verifiedInvites: number;
  pendingInvites: number;
  fraudulentInvites: number;
  isAmbassador: boolean;
  badges: { id: string; name: string; description: string }[];
  claimedMilestones: string[];
  balanceKobo: number;
  lifetimeEarnedKobo: number;
  teamId: string | null;
  teamName: string | null;
  influencer: {
    status: 'pending' | 'approved' | 'rejected';
    customCode: string;
    commissionKobo: number;
  } | null;
}

export interface ReferralRow {
  id: string;
  referredUserId: string;
  referredUserName: string;
  status: 'pending' | 'verified' | 'fraudulent';
  step: string;
  codeUsed: string;
  retentionActiveDays: number;
  retentionRatePercent: number;
  createdAt: string;
  qualifiedAt: string | null;
}

export interface ReferralAnalytics {
  clicks: number;
  installs: number;
  successfulRegistrations: number;
  verifiedReferrals: number;
  fraudulentReferrals: number;
  conversionRate: number;
}

export interface LedgerEntry {
  id: string;
  deltaKobo: number;
  reason: string;
  sourceType: string | null;
  sourceId: string | null;
  description: string | null;
  createdAt: string;
  amountNaira: string;
  isCredit: boolean;
}

export interface BalanceSummary {
  balanceKobo: number;
  lifetimeEarnedKobo: number;
  minimumWithdrawalKobo: number;
  canWithdraw: boolean;
  balanceNaira: string;
  lifetimeEarnedNaira: string;
}

export type LeaderboardPeriod = 'weekly' | 'biweekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  campus: string;
  verifiedInvites: number;
  prizeKobo: number;
}

export interface LeaderboardBoards {
  weekly: LeaderboardEntry[];
  biweekly: LeaderboardEntry[];
  monthly: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
  prizes: Record<'weekly' | 'biweekly' | 'monthly' | 'allTime', number[]>;
}

export interface MyRank {
  rank: number | null;
  verifiedInvites: number;
  prizeKobo: number;
  nextRankGap: number;
  nextRankPrizeKobo: number;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  verifiedInvites: number;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  captainId: string;
  totalVerifiedInvites: number;
  rank: number;
  estimatedPrizeKobo: number;
  members: TeamMember[];
}

export interface TreasureCode {
  id: string;
  code: string;
  campusName: string;
  locationHint: string;
  prizeKobo: number;
  monthNumber: number;
  isRedeemed: boolean;
  redeemedByName: string | null;
  redeemedAt: string | null;
  proximityRequired: boolean;
}

export interface Influencer {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  campus: string | null;
  customCode: string;
  campaignName: string;
  handles: Record<string, string | null>;
  commissionKobo: number;
  verifiedReferrals: number;
  rank: number;
  prizeKobo: number;
  estimatedCommissionKobo: number;
  analytics: {
    clicks: number;
    installs: number;
    verifiedReferrals: number;
    conversionRate: number;
  };
}

export interface Payout {
  id: string;
  amountKobo: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'pending_review' | 'approved' | 'paid' | 'rejected';
  fraudRiskScore: number;
  rejectionReason: string | null;
  socialTagConfirmed: boolean;
  requestedAt: string;
  processedAt: string | null;
}

/** Kobo → a display string. The ONLY place money is converted for display. */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
