/**
 * Documents — and enforces — which settings actually persist.
 *
 * ## The problem this exists for
 *
 * Changing a setting in the app updates React state immediately, so the UI looks
 * like it saved. Separately, a debounced effect posts roughly thirty fields to
 * `persistProfileToBackend`. That function forwarded only a handful, because the
 * backend's `PATCH /me` accepts only five.
 *
 * Every other field was accepted by the function, ignored, and lost — no error,
 * no warning, and visually indistinguishable from success. The user's change was
 * gone on the next reload. That is the whole of "settings are dummy and no dey
 * work", and it is invisible in review precisely because nothing throws.
 *
 * ## What this test does about it
 *
 * It reads the fields the effect actually sends, and requires every one of them to
 * appear in one of two explicit lists: MAPPED (the backend stores it) or KNOWN_GAP
 * (the backend has no column yet). A field in neither list fails the suite.
 *
 * That converts a silent data-loss bug into a compile-time-ish failure. It does not
 * fix the missing columns — those need backend work — but it means the gap can
 * never again grow quietly, and it stops anyone "fixing" Settings by adding a
 * toggle the server silently discards.
 *
 * Run: npx tsx tests/settings-persistence.test.ts
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const readBackend = (rel: string) => readFileSync(join(root, '..', 'nearby-backend', rel), 'utf8');

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

/**
 * The two files this test spans, and why they are different files.
 *
 * The MAPPING (`persistProfileToBackend`) lives in the controller. The PAYLOAD it
 * is called with lives in the profile persistence hook. Reading the payload out of
 * the controller — as an earlier version of this test did — silently collects every
 * destructured name in a 2,500-line file instead of the thirty fields actually
 * sent, and reports 388 failures that are all the test's own fault.
 */
const mapperFile = stripComments(read('src/app/hooks/useNearbyController.ts'));
const payloadFile = stripComments(read('src/features/profile/hooks/useProfileBackendPersistence.ts'));

/**
 * Strip comments. Done FIRST, before any brace matching.
 *
 * Not a nicety — the payload carries a long note explaining a past bug that
 * contains an apostrophe ("Alice's autosave fires"). A character-by-character
 * scanner that tracks string state sees that apostrophe as an opening quote, never
 * finds the close, and swallows the rest of the file. Removing comments up front
 * means the scanner only ever sees real code.
 *
 * The `(^|[^:])` guard stops it eating `https://` inside a string literal.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Text between an opening brace and its match, in comment-free source. */
function bracedBlock(source: string, openIndex: number): string {
  let depth = 0;
  let inString: string | null = null;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (ch === inString && source[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return '';
}

// ── Read the backend's contract ─────────────────────────────────────────────

const dto = readBackend('src/users/users.dto.ts');
const backendFields = new Set(
  [...dto.matchAll(/^\s{4}([a-zA-Z][a-zA-Z0-9]*):\s*z\./gm)].map((m) => m[1]),
);

check(
  'the backend schema was located',
  backendFields.size > 0,
  'could not parse UpdateMeSchema — this test is not checking anything',
);

// ── Read what the frontend actually sends ───────────────────────────────────

const callIndex = payloadFile.indexOf('persistProfileToBackend({');
check(
  'the profile payload was located',
  callIndex !== -1,
  'the debounced payload moved — update this test',
);

const payloadBlock =
  callIndex === -1 ? '' : bracedBlock(payloadFile, payloadFile.indexOf('{', callIndex));

// The object mixes `key: value` with ES shorthand (`appLanguage,`), so both forms
// have to match. Colon-only matching (an earlier attempt) found zero fields.
const sentFields = new Set(
  [...payloadBlock.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*[,:]/gm)].map((m) => m[1]),
);

check(
  'the payload sends a plausible number of fields',
  sentFields.size > 5 && sentFields.size < 80,
  `found ${sentFields.size} — if this is enormous the parser is reading the wrong block`,
);

// ── Read what the mapper forwards ───────────────────────────────────────────

const mapperIndex = mapperFile.indexOf('const persistProfileToBackend = async');
const mapperBlock =
  mapperIndex === -1 ? '' : bracedBlock(mapperFile, mapperFile.indexOf('{', mapperIndex));

check(
  'the mapper was located',
  mapperBlock.length > 0,
  'persistProfileToBackend moved or was renamed — update this test',
);

// ── The two lists ───────────────────────────────────────────────────────────

/** Backend field this payload key maps onto when it is forwarded. */
const MAPPED: Record<string, string> = {
  name: 'displayName',
  customProfilePhoto: 'avatarUrl',
  customStatus: 'customStatus',
  bio: 'bio',
};

/**
 * Sent by the frontend, not stored by the backend. Every entry is a setting that
 * currently does not survive a reload.
 *
 * These are not "unknown"; they are known and listed. Removing a name from this
 * list requires the backend column to exist first — then move it to MAPPED.
 */
const KNOWN_GAP = new Set([
  'appLanguage',
  'isSubscribed',
  'isUserVisibleOnRadar',
  'userRadarStatusText',
  'userRadarEmoji',
  'customAccentColor',
  'customChatBg',
  'customChatBubbleStyle',
  'customChatFont',
  'userGroupInvitePolicy',
  'userGroupCallPolicy',
  'myNoteText',
  'gbFreezeLastSeen',
  'gbAntiDelete',
  'gbHideOnline',
  'gbBlueTickOnReply',
  'contacts',
  'followers',
  'following',
  'followersCount',
  'followingCount',
  'trustScore',
  'meetupsCompleted',
  'username',
  'website',
]);

/**
 * Not user settings at all — metadata the payload carries alongside them.
 *
 * Kept separate from KNOWN_GAP on purpose: a gap is something we intend to store
 * and currently cannot, whereas these will never be user-editable fields. Folding
 * them into the gap list would inflate it and make real gaps harder to count.
 */
const BOOKKEEPING = new Set([
  'uid',
  'updatedAt',
]);

// ── Assertions ──────────────────────────────────────────────────────────────

for (const field of [...sentFields].sort()) {
  if (field in MAPPED) {
    check(
      `"${field}" is forwarded to the backend`,
      new RegExp(`payload\\.${MAPPED[field]}\\s*=`).test(mapperBlock),
      `expected payload.${MAPPED[field]} to be assigned in persistProfileToBackend`,
    );
  } else if (BOOKKEEPING.has(field)) {
    check(`"${field}" is bookkeeping, not a user setting`, true);
  } else if (KNOWN_GAP.has(field)) {
    // Explicitly accepted as not-yet-persisted. Nothing to assert at runtime; the
    // value of this branch is that the field is accounted for rather than ignored.
    check(`"${field}" is a documented gap, not a silent loss`, true);
  } else {
    check(
      `"${field}" has an explicit persistence decision`,
      false,
      'this field is sent to persistProfileToBackend but is neither forwarded to the API nor listed in KNOWN_GAP — ' +
        'add it to MAPPED (and give it a backend column) or to KNOWN_GAP with a reason',
    );
  }
}

// ── Every mapped field must exist in the backend schema ─────────────────────

for (const [local, remote] of Object.entries(MAPPED)) {
  check(
    `"${local}" maps to a real backend field (${remote})`,
    backendFields.has(remote),
    `PATCH /me does not accept "${remote}", so this write would be rejected`,
  );
}

// ── The count, surfaced as a headline ───────────────────────────────────────

const mappedCount = Object.keys(MAPPED).filter((f) => sentFields.has(f)).length;
const gapCount = [...sentFields].filter((f) => KNOWN_GAP.has(f)).length;

console.log(
  `\n  \x1b[1m${mappedCount} of ${sentFields.size} profile fields persist to the backend; ` +
    `${gapCount} are documented gaps.\x1b[0m\n`,
);

// ── Report ──────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass);
for (const r of results) {
  if (r.pass) {
    console.log(`  \x1b[32m✓\x1b[0m ${r.name}`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${r.name}`);
    if (r.detail) console.log(`      → ${r.detail}`);
  }
}

const passed = results.length - failed.length;
console.log(`\nRESULT: ${passed} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);
