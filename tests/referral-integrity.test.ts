/**
 * Integrity guards for the referral programme's money paths.
 *
 * WHY THESE ASSERT ON SOURCE TEXT
 *
 * The failures being guarded against here are the ones that are invisible in a
 * single-user test on a good connection: a balance that two concurrent requests
 * both spend, a reward that pays twice because a retry arrived, a read-check-write
 * that two people pass at the same moment. Every one of those produces code that
 * typechecks, builds, and behaves perfectly in a demo.
 *
 * What can be asserted cheaply and honestly is the *shape* of the code: that the
 * unique constraint exists, that the credit carries an idempotency key, that the
 * hold and the insert are inside one transaction. That is weaker than an
 * integration test against a real Postgres and it does not pretend otherwise —
 * but it is the guard that fails loudly if someone removes the constraint or
 * moves the ledger write out of the transaction six months from now.
 *
 * The backend files are read from the sibling checkout, the same way
 * `chat-delivery.test.ts` reads the gateway.
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ESM: `__dirname` does not exist here, so derive it from the module URL.
const __dirname = dirname(fileURLToPath(import.meta.url));

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const readBackend = (rel: string) => readFileSync(join(root, '..', 'nearby-backend', rel), 'utf8');
const hasBackend = (rel: string) => existsSync(join(root, '..', 'nearby-backend', rel));

const schema = readBackend('src/database/referral-schema.ts');
const ledgerService = readBackend('src/ledger/ledger.service.ts');
const referralsService = readBackend('src/referrals/referrals.service.ts');
const milestonesService = readBackend('src/milestones/milestones.service.ts');
const teamsService = readBackend('src/teams/teams.service.ts');
const treasureService = readBackend('src/treasure/treasure.service.ts');
const payoutsService = readBackend('src/payouts/payouts.service.ts');
const influencersService = readBackend('src/influencers/influencers.service.ts');
const leaderboardService = readBackend('src/leaderboard/leaderboard.service.ts');
const statsService = readBackend('src/stats/stats.service.ts');
const adminGuard = readBackend('src/auth/admin.guard.ts');
const migration = readBackend('src/database/migrations/0012_bright_jackal.sql');
const journal = readBackend('src/database/migrations/meta/_journal.json');
const appModule = readBackend('src/app.module.ts');

/**
 * Source with comments removed.
 *
 * The files in this feature explain the original bugs in their comments — "the
 * original wrote `clicks: 12`", "the old check was read-then-write". A negative
 * assertion tested against raw text fails on those very explanations, which
 * would make the guard useless the moment it is documented. So every "must not
 * contain" check runs against code with comments stripped.
 */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const referralApi = read('src/features/referrals/api.ts');
const captureHook = read('src/features/referrals/hooks/useReferralCapture.ts');
const programHook = read('src/features/referrals/hooks/useReferralProgram.ts');
const hub = read('src/features/referrals/components/ReferralHub.tsx');
const earningsPanel = read('src/features/referrals/components/EarningsPanel.tsx');
const menuTab = read('src/app/components/MenuTab.tsx');
const appView = read('src/app/components/NearbyAppView.tsx');
const appRoot = read('src/app/App.tsx');

// ── 1. Balances must be derived, never stored ───────────────────────────────

// The original kept `claimableBalanceNaira` as a mutable field and did the
// arithmetic in the browser, on a collection anyone could write to. There must
// be no balance column to write to.
check(
  'no stored balance column exists in the referral schema',
  !/(integer|text|doublePrecision|numeric)\('balance/i.test(schema),
  'a balance column has appeared — balances must stay derived from the ledger',
);
check(
  'balance is computed as a SUM over ledger entries',
  /SUM\(\$\{schema\.ledgerEntries\.deltaKobo\}\)/.test(ledgerService),
  'balanceKobo no longer sums the ledger',
);
check(
  'money is stored as an integer number of kobo',
  /integer\('delta_kobo'\)\.notNull\(\)/.test(schema) && /integer\('value_kobo'\)/.test(schema),
  'a money column stopped being an integer in kobo',
);

// ── 2. The ledger is append-only ────────────────────────────────────────────

// An edit or delete on the ledger destroys the audit trail, which is the whole
// reason money is recorded as entries instead of a number.
check(
  'nothing updates the ledger',
  !/update\(\s*schema\.ledgerEntries/.test(ledgerService),
  'the ledger is being mutated — it must be append-only',
);
check(
  'nothing deletes from the ledger',
  !/delete\(\s*schema\.ledgerEntries/.test(ledgerService),
  'ledger rows are being deleted — the audit trail is gone',
);

// ── 3. Idempotency is enforced where money moves ────────────────────────────

check(
  'ledger entries carry a unique idempotency key',
  /idempotencyKey:[\s\S]{0,80}\.notNull\(\)\.unique\(\)/.test(schema),
  'the idempotency unique index is missing — a retry will pay twice',
);
check(
  'the ledger insert ignores a duplicate rather than erroring',
  /onConflictDoNothing\(\s*\{\s*target:\s*schema\.ledgerEntries\.idempotencyKey\s*\}\s*\)/.test(
    ledgerService,
  ),
  'ledger.apply no longer deduplicates on the idempotency key',
);
check(
  'the ledger can run inside a caller transaction',
  /executor\?: Executor/.test(ledgerService) && /executor \?\? this\.db/.test(ledgerService),
  'ledger.apply is back to always using the pooled client — credits will commit outside their transaction',
);

// Every earning path must supply a deterministic key.
for (const [label, source] of [
  ['milestones', milestonesService],
  ['treasure', treasureService],
  ['influencer commission', referralsService],
  ['payout hold', payoutsService],
] as const) {
  check(
    `${label} credits carry an idempotency key`,
    /idempotencyKey:/.test(source),
    `${label} can credit the same reward twice`,
  );
}
check(
  'the payout hold is keyed to its own payout row',
  /idempotencyKey: `payout_hold:\$\{created\.id\}`/.test(payoutsService),
  'the payout hold is no longer tied to the payout that caused it',
);
check(
  'a rejected payout refunds with a deterministic key',
  /idempotencyKey: `payout_refund:\$\{payout\.id\}`/.test(payoutsService),
  'a rejection can refund twice',
);

// ── 4. One atomic statement per state change ────────────────────────────────

check(
  'treasure redemption guards inside the UPDATE itself',
  /update\(schema\.treasureCodes\)[\s\S]{0,400}?redeclared_by IS NULL/.test(treasureService) ||
    /update\(schema\.treasureCodes\)[\s\S]{0,400}?redeemed_by} IS NULL/.test(treasureService) ||
    treasureService.includes('schema.treasureCodes.redeemedBy} IS NULL'),
  'the redemption guard has moved back out of the statement that does the write',
);
check(
  'treasure redemption serialises per user with an advisory lock',
  /pg_advisory_xact_lock\(hashtext\(\$\{userId\}\)\)/.test(treasureService),
  'the 3-per-month cap can be exceeded by concurrent claims',
);
check(
  'treasure redemption credits inside its transaction',
  /db\.transaction\(async \(tx\)[\s\S]*?this\.ledger\.apply\([\s\S]*?\n\s*tx,\n\s*\);/.test(
    treasureService,
  ),
  'the prize is credited outside the redemption transaction',
);
check(
  'milestone claims are inserted with a conflict guard',
  /insert\(schema\.milestoneClaims\)[\s\S]{0,400}?onConflictDoNothing/.test(milestonesService),
  'a milestone can be claimed twice',
);
check(
  'milestone claims and their credit share a transaction',
  /db\.transaction\(async \(tx\)[\s\S]*?this\.ledger\.apply\([\s\S]*?\},\s*tx\);/.test(
    milestonesService,
  ),
  'the milestone credit is outside the claim transaction',
);
check(
  'a duplicate referred user is refused by the database',
  /referredUserId: uuid\('referred_user_id'\)[\s\S]{0,120}?\.unique\(\)/.test(schema) &&
    /onConflictDoNothing\(\s*\{\s*target:\s*schema\.referrals\.referredUserId\s*\}\s*\)/.test(
      referralsService,
    ),
  'a person can be attributed to two referrers',
);
check(
  'withdrawal requests lock the user row and re-read the balance inside it',
  /FOR UPDATE/.test(payoutsService) &&
    /db\.transaction\(async \(tx\)[\s\S]*?SUM\(\$\{schema\.ledgerEntries\.deltaKobo\}\)/.test(
      payoutsService,
    ),
  'two simultaneous withdrawals can both pass the balance check',
);
check(
  'a payout in a terminal state cannot be moved again',
  /status === 'paid' \|\| payout\.status === 'rejected'/.test(payoutsService),
  'a rejected payout can be re-rejected, or a paid one re-processed',
);

// ── 5. One squad per person, capped at five ─────────────────────────────────

check(
  'team membership is unique per user in the schema',
  /userId: uuid\('user_id'\)[\s\S]{0,120}?\.unique\(\)/.test(schema),
  'a user can join two squads',
);
check(
  'joining a squad cannot create a duplicate membership',
  /insert\(schema\.teamMembers\)[\s\S]{0,300}?onConflictDoNothing/.test(teamsService),
  'the squad join no longer deduplicates',
);

// ── 6. Anti-fraud is real, not decorative ──────────────────────────────────

check(
  'a referral only counts once the invited user is a real user',
  /termsAcceptedAt/.test(referralsService) && /no-display-name/.test(referralsService),
  'qualification no longer requires terms acceptance and a profile name',
);
check(
  'the risk score is computed from stored signals',
  /sharedIps|sharedIps/.test(referralsService) && /riskScore\(/.test(referralsService),
  'the risk score is no longer derived from referral data',
);
check(
  'nothing hardcodes a fraud risk score',
  !/fraudRiskScore:\s*10\b/.test(code(payoutsService)) &&
    !/return 10\s*;/.test(code(referralsService)),
  'a fixed risk score has been reintroduced',
);
check(
  'the auto-claimed tiers exist so the double-pay cannot return',
  /autoClaim: true/.test(milestonesService) && /autoClaimFor\(/.test(milestonesService),
  'the 20 and 50 invite tiers are no longer settled through one path',
);
check(
  'the admin guard fails closed when unconfigured',
  /if \(admins\.length === 0\) \{[\s\S]{0,400}?throw new ForbiddenException/.test(
    code(adminGuard),
  ) && !/if \(admins\.length === 0\)\s*return true/.test(code(adminGuard)),
  'an empty ADMIN_FIREBASE_UIDS now means "everyone is an admin"',
);

check(
  'retention is derived from stored activity, not reported by the client',
  /recomputeRetention\(/.test(referralsService) &&
    /last_active_at/.test(referralsService) &&
    !/updateRetention/.test(code(referralsService)),
  'the client is reporting its own engagement numbers again',
);

// ── 7. Rankings and statistics come from the database ──────────────────────

check(
  'the leaderboard is ordered and paginated in SQL',
  /orderBy\(desc\(sql`COUNT\(\*\)`\)/.test(leaderboardService) &&
    /\.limit\(Math\.min\(Math\.max\(limit, 1\), 200\)\)/.test(leaderboardService) &&
    /\.offset\(/.test(leaderboardService),
  'the board is fetched whole and sorted in the client again',
);
check(
  'a user rank is counted, not looked up in a truncated list',
  /ahead/.test(leaderboardService) || /getUserRank/.test(leaderboardService),
  'ranks past the first page are unanswerable',
);
check(
  'platform stats are aggregated in SQL',
  /COUNT\(\*\) FILTER \(WHERE/.test(statsService),
  'statistics are being counted in the client',
);
check(
  'influencer analytics are derived, not hardcoded',
  !/clicks:\s*12\b/.test(code(influencersService)) &&
    !/conversionRate:\s*85\b/.test(code(influencersService)) &&
    /referralClicks/.test(influencersService) &&
    /clickCount > 0 \? Math\.round/.test(influencersService),
  'influencer numbers are invented again',
);

// ── 8. Migration and wiring ────────────────────────────────────────────────

check(
  'the migration creates the unique constraints',
  /CONSTRAINT "ledger_entries_idempotency_key_unique" UNIQUE/.test(migration) &&
    /CONSTRAINT "referrals_referred_user_id_unique" UNIQUE/.test(migration) &&
    /CONSTRAINT "team_members_user_id_unique" UNIQUE/.test(migration),
  'the unique guarantees are missing from the SQL that actually creates the tables',
);
check(
  'the migration is registered in the journal',
  /"idx":\s*12/.test(journal) && /0012_bright_jackal/.test(journal),
  'the migration file exists but will never run',
);
check(
  'every referral module is mounted in the app',
  [
    'LedgerModule',
    'ReferralsModule',
    'MilestonesModule',
    'TeamsModule',
    'TreasureModule',
    'PayoutsModule',
    'InfluencersModule',
    'LeaderboardModule',
    'StatsModule',
  ].every((name) => appModule.includes(name)),
  'a module is written but not imported — its routes do not exist',
);
check(
  'seeding cannot crash the boot',
  /onModuleInit[\s\S]{0,400}?catch/.test(milestonesService) &&
    /onModuleInit[\s\S]{0,400}?catch/.test(treasureService),
  'a missing table at boot now takes the whole backend down',
);

// ── 9. The client cannot assert anything about money ───────────────────────

check(
  'the referral API sends no balance, count or eligibility flag',
  !/balanceKobo:/.test(code(referralApi)) && !/verifiedInvites:/.test(code(referralApi)),
  'the client has started telling the server what it has earned',
);
check(
  'the analytics panel has no click-count repair logic',
  !/Math\.max\(clicks/.test(code(hub)) && !/Math\.max\(clicks/.test(code(programHook)),
  'the invented click count is back',
);
check(
  'no panel does arithmetic on a naira value',
  !/balanceNaira\s*[-+*/]/.test(code(earningsPanel)) &&
    !/deltaKobo\s*\/\s*100/.test(code(earningsPanel)),
  'a panel is converting or mutating money outside formatNaira',
);
check(
  'the invite capture stores only the code',
  /localStorage\.setItem\(STORAGE_KEY, clean\)/.test(captureHook) &&
    !/localStorage\.setItem\([^)]*[Bb]alance/.test(code(captureHook)),
  'client state is being treated as a source of truth again',
);
check(
  'every write action re-reads the server rather than caching a result',
  (programHook.match(/refresh/g) ?? []).length > 4 &&
    /await onRefresh\(\)/.test(earningsPanel),
  'the UI keeps its own copy of the balance after a write',
);

// ── 10. Mount points ───────────────────────────────────────────────────────

check(
  'the rewards hub is reachable from settings',
  /settingsSubView === 'referrals'/.test(menuTab) && /<ReferralHub/.test(menuTab),
  'the hub exists but nothing can open it',
);
// The invite link is clicked by someone with no account, so capture has to run
// on the landing/onboarding screens. Inside NearbyAppView it would only mount
// after sign-in, by which point the ?ref= in the URL is long gone.
check(
  'invite-link capture runs at the app root, above the auth branch',
  /<ReferralCapture \/>/.test(appRoot) &&
    appRoot.indexOf('<ReferralCapture />') < appRoot.indexOf('isSplashActive'),
  'capture is inside the signed-in branch again — ?ref= will be missed on the landing screen',
);
check(
  'invite-link capture is mounted exactly once',
  !/<ReferralCapture \/>/.test(appView),
  'capture is mounted in two places, so a click is logged twice',
);

// ── Report ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
for (const r of results) {
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.pass ? '' : `\n      → ${r.detail}`}`);
}
console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
