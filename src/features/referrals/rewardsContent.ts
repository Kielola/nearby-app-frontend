/**
 * The referral rewards, in one place.
 *
 * Every number the app shows about money comes from this file. It exists because
 * the previous arrangement had the rates written in three different components
 * while the database paid a fourth, different amount — so the app advertised
 * ₦2,000 per ten referrals and credited nothing at ten at all.
 *
 * `tests/rewards.test.ts` checks these numbers against the backend's
 * `MILESTONE_TIERS`. If somebody changes the payout rule on the server without
 * changing this file, the suite fails rather than letting the app quietly go back
 * to advertising a reward nobody receives.
 *
 * ## The scheme
 *
 *     ₦2,000 for every completed block of 10 verified referrals.
 *
 * Cumulative and repeating:
 *
 *     10 referrals -> ₦2,000
 *     20 referrals -> ₦4,000
 *     50 referrals -> ₦10,000
 *
 * Plus a monthly Area vs Area challenge, described further down.
 */

import { SUPPORT_EMAIL } from '../legal/content/termsOfService';

/** Naira paid per completed block. */
export const REWARD_PER_BLOCK_NGN = 2_000;

/** How many verified referrals make a block. */
export const REFERRALS_PER_BLOCK = 10;

/**
 * What a given number of verified referrals has earned, in naira.
 *
 * Truncating division on purpose: 19 referrals is one completed block, so it pays
 * ₦2,000, and the 20th is what makes it ₦4,000. Rounding up would promise money
 * for a block that has not finished.
 */
export function rewardNairaFor(verifiedReferrals: number): number {
  const blocks = Math.floor(Math.max(0, verifiedReferrals) / REFERRALS_PER_BLOCK);
  return blocks * REWARD_PER_BLOCK_NGN;
}

/** How many referrals are still needed for the next block, or 0 if exactly on one. */
export function referralsToNextBlock(verifiedReferrals: number): number {
  const remainder = Math.max(0, verifiedReferrals) % REFERRALS_PER_BLOCK;
  return remainder === 0 ? REFERRALS_PER_BLOCK : REFERRALS_PER_BLOCK - remainder;
}

// ── The Area vs Area challenge ──────────────────────────────────────────────

export const AREA_CHALLENGE = {
  /** Prize per winner, in naira. */
  prizeNaira: 10_000,
  /** How many winners the winning area produces each month. */
  winnersPerWinningArea: 10,
  /**
   * Verified referrals needed to be in contention. This is also why the two
   * rewards line up: at 50 referrals the referral rate alone has paid ₦10,000, so
   * a challenge winner is looking at roughly ₦20,000 for the month.
   */
  minimumReferrals: 50,
  cadence: 'monthly' as const,
};

// ── How to claim ────────────────────────────────────────────────────────────

export const CLAIM_STEPS = [
  {
    title: 'Repost our latest post',
    detail: 'Share our newest post on any of your social media accounts.',
  },
  {
    title: `Screenshot your referral count — from inside the Nearby app`,
    detail:
      'Not a number you typed, and not a screenshot of anything else. Open the Invite tab in Nearby and ' +
      'capture the count shown there. We match that against our own records.',
  },
  {
    title: `${AREA_CHALLENGE.cadence === 'monthly' ? 'Send' : 'Send'} both screenshots to our DM`,
    detail: 'The repost and your referral count, on any of our social media accounts below.',
  },
] as const;

/**
 * Why the screenshot has to come from the app.
 *
 * Worth stating plainly in the UI rather than only in a policy: it tells an honest
 * user exactly what to send, and it tells anyone else that a doctored image will
 * not survive the check.
 */
export const CLAIM_VERIFICATION_NOTE =
  'Rewards are verified by hand for now. We check every claim against our own records, so the referral ' +
  'count in your screenshot must match what our database shows for your account. Edited numbers are ' +
  'found immediately and forfeit the reward.';

// ── Where to send a claim ───────────────────────────────────────────────────

/**
 * Our social accounts, where a claim is sent.
 *
 * ## Two handles, and they are NOT the same string
 *
 *   Instagram + TikTok : app_nearby_
 *   X                  : nearby_app_
 *
 * Note the order of the words. These are close enough to be swapped by a glance,
 * and swapping them sends a user to an account that is not ours to hand over a
 * screenshot of their referral count. `tests/rewards.test.ts` asserts each handle
 * against its own platform so a swap fails the build rather than the user.
 *
 * ## To add or change one
 *
 * Set the handle and the profile URL. An entry with an empty handle is treated as
 * "we do not have this account" and is not rendered — the UI falls back to the
 * support email instead. That fallback is deliberate: a plausible-looking made-up
 * URL would send users somewhere that is not ours, which is worse than no link.
 *
 * WhatsApp was removed at the owner's request — it is not one of the claim
 * destinations.
 */
export interface SocialAccount {
  platform: string;
  /** Without the leading "@". Empty means we do not have this account. */
  handle: string;
  /** Profile URL. Empty means we do not have this account. */
  url: string;
  /** One line telling the user how to send the claim from this platform. */
  howToClaim: string;
}

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  {
    platform: 'Instagram',
    handle: 'app_nearby_',
    url: 'https://www.instagram.com/app_nearby_',
    howToClaim: 'Open our profile and tap Message to send both screenshots.',
  },
  {
    platform: 'TikTok',
    handle: 'app_nearby_',
    url: 'https://www.tiktok.com/@app_nearby_',
    howToClaim: 'Open our profile and use the message button.',
  },
  {
    platform: 'X',
    handle: 'nearby_app_',
    url: 'https://x.com/nearby_app_',
    howToClaim: 'Send us a direct message on X.',
  },
];

/** The accounts that are actually usable. */
export function configuredSocialAccounts(): SocialAccount[] {
  return SOCIAL_ACCOUNTS.filter(
    (account) => account.handle.trim() !== '' && account.url.trim() !== '',
  );
}

/** Where to send a claim when no social account is configured. */
export const CLAIM_FALLBACK_EMAIL = SUPPORT_EMAIL;
