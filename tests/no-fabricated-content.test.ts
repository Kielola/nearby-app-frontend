/**
 * Guards that Explore never invents places, events or people.
 *
 * ## Why this test exists
 *
 * Explore previously fabricated a lot of content and presented all of it as real:
 *
 *   - venues built by concatenating real street names with generic suffixes,
 *     carrying invented ratings, invented review counts and Unsplash stock photos,
 *     positioned a few hundred metres from the user by lat/lng offset so they
 *     looked genuinely local
 *   - **safety claims attached to those invented places** — "Active Security &
 *     Bright Indoor Lighting", "24/7 CCTV & Mall Guards"
 *   - a "Trending Nearby" list of gatherings with invented distances
 *     ("350m away") and invented participant counts
 *
 * None of that is visible in a demo. It looks better than the truth, which is
 * exactly why it survives code review: the screen is *fuller* than it should be,
 * and emptiness reads as a bug.
 *
 * The harm is specific to this product. Nearby exists to get strangers to meet in
 * person. Telling someone that a well-lit, CCTV-covered café is 200m away when no
 * such café exists — or that a running club meets at sunrise when no such club
 * does — sends a real person to a real place expecting safety and company that were
 * never there. That is not a cosmetic defect and it is not something a user can
 * detect for themselves, because fabricated data is designed to be indistinguishable
 * from real data.
 *
 * So the rules below are enforced mechanically. If a future change reintroduces any
 * of these patterns, the suite fails and says which pattern and where.
 *
 * Run: npx tsx tests/no-fabricated-content.test.ts
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

/**
 * Source with comments stripped.
 *
 * Essential here, and a genuine trap: the removal notes in these files quote the
 * very strings being forbidden ("Ahmadu Bello Way Cafe & Workspace", "24/7 CCTV &
 * Mall Guards") in order to explain why they are gone. Asserting against raw text
 * fails on those explanations — a guard that cries wolf gets deleted, and then it
 * protects nothing.
 */
function code(src: string): string {
  return (
    src
      // Block comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Line comments — but not the `//` inside a URL, which would eat the rest of
      // a line of real code.
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  );
}

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

const exploreFiles = [
  'src/features/explore/components/ExploreTab.tsx',
];

const sources = exploreFiles.map((f) => ({ path: f, raw: read(f), body: code(read(f)) }));

// ── 1. No generated-fake-data functions ─────────────────────────────────────

const FABRICATION_NAMES = [
  'generateDynamic',
  'generateFake',
  'generateDummy',
  'generateMock',
  'mockMeetups',
  'mockPlaces',
  'demoMeetups',
  'demoPlaces',
  'fakePlaces',
  'seedFake',
];

for (const { path, body } of sources) {
  for (const name of FABRICATION_NAMES) {
    check(
      `no "${name}" in ${path.split('/').pop()}`,
      !new RegExp(`\\b${name}`, 'i').test(body),
      'a function that manufactures content is back — see the header of this file',
    );
  }
}

// ── 2. No coordinate-offset fabrication ─────────────────────────────────────
//
// The specific technique: take the user's real position and nudge it, so invented
// places test as "nearby". A real venue's coordinates come from the places API.

for (const { path, body } of sources) {
  check(
    `no lat/lng offset fabrication in ${path.split('/').pop()}`,
    !/\b(lat|lng|latitude|longitude)Offset\b/.test(body),
    'coordinates are being derived by offsetting the user position instead of coming from a data source',
  );
}

// ── 3. No invented event metrics ────────────────────────────────────────────
//
// `participants: 12` / `distance: '350m away'` as literals can only be invented —
// a real event's numbers come from the server.

for (const { path, body } of sources) {
  const literalDistance = /distance:\s*['"`][^'"`]*\d+\s*(m|km)\b/i.test(body);
  check(
    `no hardcoded event distance in ${path.split('/').pop()}`,
    !literalDistance,
    'an event distance is written as a literal (e.g. "350m away") — it cannot be real',
  );

  const literalParticipants = /participants:\s*\d+\b/.test(body);
  check(
    `no hardcoded participant count in ${path.split('/').pop()}`,
    !literalParticipants,
    'a participant count is written as a literal (e.g. participants: 12) — it cannot be real',
  );
}

// ── 4. No safety claims in this file ────────────────────────────────────────
//
// Safety wording belongs to a real venue's own listing from the places API, never
// to a string this codebase writes. Any CCTV/security assurance appearing as a
// literal here is being asserted by us about somewhere we have not verified.

const SAFETY_CLAIMS = [/CCTV/i, /Mall Guards/i, /Active Security/i, /24\/7 .{0,24}Guard/i];

for (const { path, body } of sources) {
  for (const claim of SAFETY_CLAIMS) {
    check(
      `no invented safety claim (${claim.source}) in ${path.split('/').pop()}`,
      !claim.test(body),
      'this codebase is asserting security facts about a place — that must come from the venue, not from us',
    );
  }
}

// ── 5. The honest empty state must exist AND be reachable ───────────────────

const exploreRaw = read('src/features/explore/components/ExploreTab.tsx');

check(
  'places can report why the list is empty',
  /placesUnavailableReason/.test(code(exploreRaw)),
  'without a reason, an empty list is indistinguishable from a bug and someone will "fix" it by inventing data',
);

check(
  'the empty reason is actually rendered',
  /placesUnavailableReason\s*&&/.test(code(exploreRaw)) &&
    /\{placesUnavailableReason\}/.test(exploreRaw),
  'a reason that is computed but never displayed is the bug that started all of this',
);

check(
  'the empty state states the no-fabrication policy',
  /only list real, publicly accessible venues/i.test(exploreRaw),
  'users should be told why the list is empty, not just that it is',
);

// ── 6. The removal must not be quietly reverted ─────────────────────────────

// The per-category safety stereotype is the subtlest form this took: it fired on
// REAL venues, asserting "24/7 CCTV & Mall Guards" for any shopping mall and
// "Active Security & Bright Indoor Lighting" for any café. Google Places does not
// report CCTV coverage, so every one of those was invented by us.
for (const { path, body } of sources) {
  check(
    `no category-derived safety guarantee in ${path.split('/').pop()}`,
    !/secFeature|Community Presence|Ranger Patrols|Campus Patrols/.test(body),
    'a venue is being given a safety assurance derived from its category, not from the venue',
  );
}

// ── 5b. No invented metrics in the venue builders ───────────────────────────
//
// These defaults are how fabrication survives review: each one looks like a
// harmless fallback, and each one is a number the app made up about a real place.

for (const { path, body } of sources) {
  const name = path.split('/').pop();
  const inventedDefaults: [string, RegExp][] = [
    ['an invented rating default', /rating:\s*[^,;]*\|\|\s*\d/],
    ['an invented review-count default', /userRatingCount:\s*[^,;]*\|\|\s*\d/],
    ['a hardcoded review count', /userRatingCount:\s*\d+\b/],
    ['an assumed-open status', /openNow:\s*['"]Open Now['"]/],
    ['a substituted stock photo', /img:\s*['"]https:\/\/images\.unsplash\.com/],
  ];
  for (const [label, pattern] of inventedDefaults) {
    check(
      `no ${label} in ${name}`,
      !pattern.test(body),
      'a real venue is being given a value the API did not provide',
    );
  }
}

// ── 5c. The render must cope with unknown values ────────────────────────────
//
// strictNullChecks is off in this project (8,963 errors if enabled), so the
// compiler will NOT catch `spot.rating.toFixed()` on null. The guard has to be
// asserted here instead, because the failure mode is a white screen for the user.

check(
  'the rating badge is guarded against a missing rating',
  /typeof spot\.rating === 'number'/.test(code(exploreRaw)),
  'strictNullChecks is off, so spot.rating.toFixed() on null crashes the card at runtime',
);
check(
  'an unknown opening status is shown as unknown',
  /Hours unknown/.test(exploreRaw) && /spot\.openNow === 'Closed'/.test(code(exploreRaw)),
  'the card implies the venue is open when its hours are not known',
);
check(
  'a missing photo falls back to a placeholder, not another venue\'s picture',
  /spot\.img \?/.test(code(exploreRaw)),
  'venues without photos get a stock image of somewhere else',
);
check(
  'unknown ratings do not get a flattering default in the ranking',
  !/rating \|\| 4\.0/.test(code(exploreRaw)),
  'invented ratings are deciding the order of the list',
);

check(
  'the venue fabricator is gone',
  !/generateDynamicLocalMeetups/.test(code(exploreRaw)),
  'the venue generator is back in live code',
);

check(
  'the invented trending list is gone',
  !/Sunrise Running Collective|Weekend Board Games Club/.test(code(exploreRaw)),
  'the fabricated trending events are back in live code',
);

// ── 7. Every place shown must come from a data source ───────────────────────
//
// `liveMeetupSpots` is the only list allowed into the places UI, and it is only
// ever assigned from the places API or the Firestore cache of real results.

{
  const body = code(exploreRaw);
  // Capture to end-of-statement rather than the first ')': `noPlacesAvailable()`
  // contains an inner paren, so a naive `[^)]*` yields "noPlacesAvailable(" and
  // the comparison below fails on a false alarm.
  const assignments = [...body.matchAll(/setLiveMeetupSpots\(([^;\n]*)\)/g)]
    .map((m) => m[1].trim())
    .filter((a) => a !== '');
  const allowed = ['noPlacesAvailable()', 'cachedSpots', 'validSpots', 'realSpots', '[]'];

  check(
    'meetup spots are only ever set from a real source',
    assignments.length > 0 && assignments.every((a) => allowed.includes(a)),
    `unexpected assignment source(s): ${assignments.filter((a) => !allowed.includes(a)).join(', ')}`,
  );
}

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
