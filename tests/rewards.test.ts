/**
 * The reward numbers, checked against the server that pays them.
 *
 * ## Why this test exists
 *
 * The app advertised "₦2,000 for every verified referral" in one panel, "₦2,000 at
 * 20 invites" in another, and the database paid ₦5,000 at 50 with nothing at 10.
 * Three numbers, none of them the same, two of them wrong. Users reaching a
 * threshold the app had promised them money for saw a balance that had not moved.
 *
 * That is not a UI bug — it is the app telling people they have earned money they
 * have not, which is the fastest way to lose their trust about everything else.
 *
 * So the rates live in exactly one file, and this test compares that file against
 * the backend's payout table. Change one without the other and the suite fails.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/rewards.test.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = join(root, '..', 'nearby-backend');

function readBackend(relativePath: string): string {
  return readFileSync(join(backendRoot, relativePath), 'utf8');
}

const {
  REWARD_PER_BLOCK_NGN,
  REFERRALS_PER_BLOCK,
  rewardNairaFor,
  referralsToNextBlock,
  AREA_CHALLENGE,
  CLAIM_STEPS,
  CLAIM_VERIFICATION_NOTE,
  SOCIAL_ACCOUNTS,
  configuredSocialAccounts,
} = await import('../src/features/referrals/rewardsContent.ts');

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. The rate ─────────────────────────────────────────────────────────────
{
  const cases: [number, number][] = [
    [0, 0],
    [1, 0], // one referral is not a block
    [9, 0],
    [10, 2_000],
    [11, 2_000], // the 11th has not completed a second block
    [19, 2_000],
    [20, 4_000],
    [30, 6_000],
    [40, 8_000],
    [50, 10_000], // the number the Area challenge is built on
    [100, 20_000],
    [105, 20_000],
  ];

  for (const [referrals, expected] of cases) {
    const got = rewardNairaFor(referrals);
    check(`  ${referrals} referrals -> ₦${expected.toLocaleString('en-NG')}`, got === expected, `got ₦${got}`);
  }

  check(
    'the rate is ₦2,000 per block',
    REWARD_PER_BLOCK_NGN === 2_000,
    `₦${REWARD_PER_BLOCK_NGN}`,
  );
  check('a block is 10 referrals', REFERRALS_PER_BLOCK === 10, `${REFERRALS_PER_BLOCK}`);

  // 50 referrals paying ₦10,000 is the stated reason the two rewards line up.
  check(
    '50 referrals earns exactly the area-challenge prize',
    rewardNairaFor(50) === AREA_CHALLENGE.prizeNaira,
    `₦${rewardNairaFor(50)} vs ₦${AREA_CHALLENGE.prizeNaira}`,
  );

  check('a negative count earns nothing rather than a negative balance', rewardNairaFor(-5) === 0);

  // The countdown must never say "0 to your next reward" while still counting.
  check('exactly on a block asks for a full block to the next', referralsToNextBlock(20) === 10);
  check('mid-block counts down correctly', referralsToNextBlock(23) === 7);
  check('one short asks for one', referralsToNextBlock(9) === 1);
}

// ── 2. The backend agrees ───────────────────────────────────────────────────
//
// Parsed from source because the backend is a separate package with its own
// NestJS dependencies. If the rule constants move, this fails loudly rather than
// silently passing on a stale match.
{
  const service = readBackend('src/milestones/milestones.service.ts');

  const perBlock = service.match(/REWARD_PER_BLOCK_KOBO\s*=\s*([\d_]+)/);
  const perTier = service.match(/REFERRALS_PER_BLOCK\s*=\s*(\d+)/);
  const maxTiers = service.match(/MAX_TIER_INVITES\s*=\s*(\d+)/);

  check('the backend defines a per-block reward', Boolean(perBlock));
  check('the backend defines a block size', Boolean(perTier));
  check('the backend defines a tier ceiling', Boolean(maxTiers));

  if (perBlock && perTier) {
    const backendPerBlock = Number(perBlock[1].replace(/_/g, '')) / 100; // kobo -> naira
    check(
      'the backend pays the same per block as the app advertises',
      backendPerBlock === REWARD_PER_BLOCK_NGN,
      `backend ₦${backendPerBlock} vs app ₦${REWARD_PER_BLOCK_NGN}`,
    );
    check(
      'the backend block size matches',
      Number(perTier[1]) === REFERRALS_PER_BLOCK,
      `backend ${perTier[1]} vs app ${REFERRALS_PER_BLOCK}`,
    );
  }

  // The old table paid the wrong amounts. If any of those numbers come back, the
  // app is advertising a rate the database does not honour.
  check(
    'the old ₦5,000-at-50 tier is gone',
    !/500_000/.test(service),
    'the previous table paid ₦5,000 at 50 where the scheme says ₦10,000',
  );
  check(
    'tiers are generated, not hand-written one by one',
    /Array\.from\(/.test(service),
    'ten hand-written entries is ten chances for a typo in an amount of money',
  );
  check(
    'a tier is not a one-off at 20',
    !/invites_20'/.test(service) || !/key:\s*'invites_20',/.test(service),
    'the old table had a single ₦2,000 tier at 20 that never repeated',
  );
}

// ── 3. Rows that already exist are actually updated ─────────────────────────
//
// This is the trap that would have made the whole change invisible. The old
// seeder inserted tiers only when the table was EMPTY, so on the live database —
// which already held the previous five rows — editing the code changed nothing.
{
  const serviceRaw = readBackend('src/milestones/milestones.service.ts');
  // Strip comments first. The replacement's own doc comment explains that it "used
  // to be seedIfEmpty" — matching that sentence is a false positive, and this exact
  // trap has now caught four assertions in this project.
  const service = serviceRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  check(
    'the reward table is synced on boot, not seeded once',
    /syncTiers/.test(service) && /onModuleInit/.test(service),
  );
  check(
    'existing rows are updated, not skipped',
    /onConflictDoUpdate/.test(service),
    'onConflictDoNothing leaves an existing database on the old amounts forever',
  );
  check(
    'the once-only seeding is gone',
    !/seedIfEmpty/.test(service),
    'seedIfEmpty works exactly once and then silently stops applying changes',
  );
  check(
    'claims already paid are not deleted',
    /active: false/.test(service) && !/\.delete\(schema\.milestones\)/.test(service),
    'deleting a tier breaks the foreign key from milestone_claims and erases the record of money already paid',
  );
  check(
    'the claimed counter survives a restart',
    !/claimedTotal:\s*sql`excluded/.test(service),
    'resetting claimedTotal would lose a count that money depends on',
  );
}

// ── 4. The Area vs Area challenge ───────────────────────────────────────────
{
  check('the prize is ₦10,000', AREA_CHALLENGE.prizeNaira === 10_000, `₦${AREA_CHALLENGE.prizeNaira}`);
  check(
    'ten winners in the winning area',
    AREA_CHALLENGE.winnersPerWinningArea === 10,
    `${AREA_CHALLENGE.winnersPerWinningArea}`,
  );
  check(
    'the minimum is 50 referrals',
    AREA_CHALLENGE.minimumReferrals === 50,
    `${AREA_CHALLENGE.minimumReferrals}`,
  );
  check('it runs monthly', AREA_CHALLENGE.cadence === 'monthly');
  check(
    'the minimum matches the referral threshold',
    AREA_CHALLENGE.minimumReferrals === 50 && rewardNairaFor(50) === 10_000,
    'the challenge minimum should be the point where the referral rate has also paid ₦10,000',
  );
}

// ── 5. The claim steps ──────────────────────────────────────────────────────
{
  check('there are three claim steps', CLAIM_STEPS.length === 3, `${CLAIM_STEPS.length}`);

  const joined = CLAIM_STEPS.map((s) => `${s.title} ${s.detail}`).join(' ').toLowerCase();
  check('it asks for a repost', joined.includes('repost'));
  check(
    'the screenshot must come from inside the app',
    joined.includes('inside the nearby app') || joined.includes('from inside the nearby app'),
    'the whole point is that the count can be matched against the database',
  );
  check('the claim is sent by DM', joined.includes('dm'));
  check(
    'it tells the user the numbers are checked',
    CLAIM_VERIFICATION_NOTE.toLowerCase().includes('records') &&
      CLAIM_VERIFICATION_NOTE.toLowerCase().includes('match'),
    'an honest user needs to know what is expected of them',
  );
  check(
    'and that editing is detected',
    CLAIM_VERIFICATION_NOTE.toLowerCase().includes('edited'),
  );
}

// ── 6. The claim destinations ────────────────────────────────────────────────
//
// The two handles are one letter-order apart:
//
//     Instagram + TikTok : app_nearby_
//     X                  : nearby_app_
//
// A swap sends users to an account that is not ours to hand over a screenshot of
// their referral count, and nobody would notice from reading the screen. So each
// handle is asserted against its own platform, and the test is written so that
// swapping them fails rather than passing on a loose match.
{
  check('there are three accounts', SOCIAL_ACCOUNTS.length === 3, `${SOCIAL_ACCOUNTS.length}`);

  check(
    'WhatsApp was removed',
    !SOCIAL_ACCOUNTS.some((a) => /whatsapp/i.test(a.platform)),
    'WhatsApp is not a claim destination',
  );

  const byPlatform = new Map(SOCIAL_ACCOUNTS.map((a) => [a.platform, a]));

  check(
    'Instagram is app_nearby_',
    byPlatform.get('Instagram')?.handle === 'app_nearby_',
    `got ${byPlatform.get('Instagram')?.handle}`,
  );
  check(
    'TikTok is app_nearby_',
    byPlatform.get('TikTok')?.handle === 'app_nearby_',
    `got ${byPlatform.get('TikTok')?.handle}`,
  );
  check(
    'X is nearby_app_ — the words are the other way round',
    byPlatform.get('X')?.handle === 'nearby_app_',
    `got ${byPlatform.get('X')?.handle}`,
  );

  // The specific swap, asserted directly rather than left implied.
  check(
    'X has not been given the Instagram handle',
    byPlatform.get('X')?.handle !== byPlatform.get('Instagram')?.handle,
    'the two handles must not be identical — a swap would be invisible on screen',
  );

  check(
    'the Instagram url carries its own handle',
    byPlatform.get('Instagram')?.url === 'https://www.instagram.com/app_nearby_',
    `got ${byPlatform.get('Instagram')?.url}`,
  );
  check(
    'the TikTok url carries the @ form',
    byPlatform.get('TikTok')?.url === 'https://www.tiktok.com/@app_nearby_',
    `got ${byPlatform.get('TikTok')?.url}`,
  );
  check(
    'the X url carries its own handle',
    byPlatform.get('X')?.url === 'https://x.com/nearby_app_',
    `got ${byPlatform.get('X')?.url}`,
  );

  check(
    'every profile url contains its own handle',
    SOCIAL_ACCOUNTS.every((a) => a.url.includes(a.handle)),
    'a url pointing at a different account than the handle shown',
  );

  check(
    'each account says how to send a claim',
    SOCIAL_ACCOUNTS.every((a) => a.howToClaim.trim().length > 10),
  );

  check('all three are usable', configuredSocialAccounts().length === 3);
  check(
    'every configured account has both a handle and a url',
    configuredSocialAccounts().every((a) => a.handle.trim() && a.url.trim()),
  );
  check(
    'no url was made up to look real',
    SOCIAL_ACCOUNTS.every((a) => a.url === '' || /^https?:\/\//.test(a.url)),
  );
}

// ── 7. The fabricated reward features are gone ──────────────────────────────
{
  const hub = readFileSync(join(root, 'src/features/referrals/components/ReferralHub.tsx'), 'utf8');

  for (const removed of ['TeamsPanel', 'TreasurePanel', 'InfluencerPanel']) {
    check(`${removed} is no longer imported`, !new RegExp(removed).test(hub));
  }
  for (const label of ['Squads', 'Treasure', 'Creators']) {
    check(
      `the ${label} tab is gone`,
      !new RegExp(`label: '${label}'`).test(hub),
      'these advertised prize pools and prize codes that do not exist',
    );
  }
  check('the Area tab is present', /label: 'Area'/.test(hub));
  check(
    'every remaining tab corresponds to a real reward',
    /label: 'Invite'/.test(hub) &&
      /label: 'Rewards'/.test(hub) &&
      /label: 'Earnings'/.test(hub) &&
      /label: 'Leaders'/.test(hub),
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
for (const r of results) {
  if (r.pass) console.log(`  \x1b[32m✓\x1b[0m ${r.name}`);
  else console.log(`  \x1b[31m✗\x1b[0m ${r.name}${r.detail ? `\n      ${r.detail}` : ''}`);
}
const passed = results.length - failed.length;
console.log(`\nRESULT: ${passed} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);
