/**
 * Regression guards for the address shown to users.
 *
 * These are REAL unit tests, not source-shape assertions: they call the actual
 * exported functions with the actual responses the geocoders return. The bug
 * being guarded against was a missing branch, and a missing branch is exactly
 * the kind of thing that can be tested directly once the logic is a pure
 * function.
 *
 * WHAT WAS WRONG
 * --------------
 * Users reported their address "showing something like an IP address". It was
 * this: `6.5833, 3.3667`. When no geocoder produced a street or town, the label
 * fell all the way through to the decimal coordinate pair — which reads like an
 * IP address and, worse, looks like a precise address while being useless.
 *
 * It happened far more often than it should have, because Nominatim's field
 * names for Nigerian places did not match the fields the code read. Measured
 * live against (7.3775, 3.9470) — Ibadan:
 *
 *   Nominatim returns { county: "Ona Ara", state: "Oyo" }
 *   The old chain read only suburb/neighbourhood/city_district/town/city/village,
 *   found nothing, and fell through to coordinates. "Oyo" was right there.
 *
 * The test cases below are those live responses, verbatim.
 */

import {
  buildResolvedAddress,
  fallbackLabelFor,
  firstOf,
  looksLikeCoordinates,
} from '../src/features/maps/services/locationService';

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. The field chain must read the fields Nigeria actually returns ───────

check(
  'firstOf reads `county` — the Ibadan case that caused the bug',
  firstOf({ county: 'Ona Ara', state: 'Oyo' }, [
    'suburb',
    'city',
    'district',
    'county',
  ]) === 'Ona Ara',
  'county is no longer in the fallback chain',
);

check(
  'firstOf prefers the more specific field when several are present',
  firstOf({ road: 'Eletu Odibo Street', suburb: 'Igbobi', city: 'Bariga' }, [
    'road',
    'suburb',
    'city',
  ]) === 'Eletu Odibo Street',
  'field priority is wrong',
);

check(
  'firstOf treats an empty string as absent, not as a value',
  firstOf({ road: '', suburb: 'Igbobi' }, ['road', 'suburb']) === 'Igbobi',
  'a blank field shadows a real one',
);

check(
  'firstOf returns null for a missing object',
  firstOf(null, ['road']) === null && firstOf(undefined, ['road']) === null,
  'a missing response object throws or fabricates a value',
);

// ── 2. The exact live response that used to produce a coordinate pair ──────

const ibadanRaw = { road: null, town: null, state: 'Oyo', country: 'Nigeria' };
const ibadan = buildResolvedAddress(ibadanRaw, 40);

check(
  'the Ibadan response resolves to "Oyo, Nigeria", not to coordinates',
  ibadan.label === 'Oyo, Nigeria',
  `expected "Oyo, Nigeria", got "${ibadan.label}"`,
);

check(
  'a state-only answer is never labelled as a coordinate pair',
  !looksLikeCoordinates(ibadan.label),
  `"${ibadan.label}" looks like an IP address`,
);

check(
  'a state-only answer is not claimed as a street address',
  ibadan.precision === 'area' && ibadan.road === null,
  'the user would be told we know their street',
);

// ── 3. The other real responses, still behaving correctly ─────────────────

const lagosRoad = buildResolvedAddress(
  { road: 'Eletu Odibo Street', town: 'Igbobi', state: 'Lagos', country: 'Nigeria' },
  25,
);
check(
  'a precise fix with a real street keeps the street',
  lagosRoad.label === 'Eletu Odibo Street, Igbobi, Lagos' && lagosRoad.precision === 'street',
  `got "${lagosRoad.label}" (${lagosRoad.precision})`,
);

const lagosCoarse = buildResolvedAddress(
  { road: 'Eletu Odibo Street', town: 'Igbobi', state: 'Lagos', country: 'Nigeria' },
  3000,
);
check(
  'a coarse fix drops the street claim but keeps a usable area',
  lagosCoarse.label === 'Igbobi, Lagos' &&
    lagosCoarse.precision === 'area' &&
    lagosCoarse.road === null,
  `got "${lagosCoarse.label}" (${lagosCoarse.precision})`,
);

const owerri = buildResolvedAddress(
  { road: null, town: 'Owerri', state: 'Imo', country: 'Nigeria' },
  60,
);
check(
  'a city-only answer is used as an area label',
  owerri.label === 'Owerri, Imo',
  `got "${owerri.label}"`,
);

const abuja = buildResolvedAddress(
  { road: 'Ahmadu Bello Way', town: null, state: 'Federal Capital Territory', country: 'Nigeria' },
  30,
);
check(
  'a street with no town still reads properly',
  abuja.label === 'Ahmadu Bello Way, Federal Capital Territory',
  `got "${abuja.label}"`,
);

const nothing = buildResolvedAddress(
  { road: null, town: null, state: null, country: null },
  50,
);
check(
  'an entirely empty response says so, rather than inventing or echoing coordinates',
  nothing.label === 'Location unavailable' && nothing.precision === 'approximate',
  `got "${nothing.label}"`,
);

// ── 4. The last-resort label must never be a coordinate pair ──────────────

const fallbackPrecise = fallbackLabelFor(6.5833, 3.3667, 30);
const fallbackCoarse = fallbackLabelFor(6.5833, 3.3667, 2500);

check(
  'the fallback label is not a coordinate pair (precise fix)',
  !looksLikeCoordinates(fallbackPrecise.label) &&
    fallbackPrecise.label === 'Location unavailable',
  `got "${fallbackPrecise.label}"`,
);
check(
  'the fallback label is honest about being approximate (coarse fix)',
  !looksLikeCoordinates(fallbackCoarse.label) &&
    fallbackCoarse.label.startsWith('Approximate location'),
  `got "${fallbackCoarse.label}"`,
);
check(
  'neither fallback case contains a decimal coordinate',
  !/\d\.\d{2,}\s*,\s*-?\d/.test(fallbackPrecise.label) &&
    !/\d\.\d{2,}\s*,\s*-?\d/.test(fallbackCoarse.label),
  'a coordinate pair is still reaching the UI',
);

// ── 5. The coordinate detector itself ────────────────────────────────────

check(
  'looksLikeCoordinates catches the reported string',
  looksLikeCoordinates('6.5833, 3.3667') && looksLikeCoordinates('-1.2345, 36.8219'),
  'the guard would let the reported bug straight through',
);
check(
  'looksLikeCoordinates does not flag real addresses',
  !looksLikeCoordinates('Eletu Odibo Street, Igbobi, Lagos') &&
    !looksLikeCoordinates('Oyo, Nigeria') &&
    !looksLikeCoordinates('Owerri') &&
    !looksLikeCoordinates(null) &&
    !looksLikeCoordinates(''),
  'a real address would be discarded as coordinates',
);
check(
  'looksLikeCoordinates is not fooled by a house number in a street name',
  !looksLikeCoordinates('12 Adeola Street, Ikeja'),
  'a numbered street would be wrongly rejected',
);

// ── Report ────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
for (const r of results) {
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.pass ? '' : `\n      → ${r.detail}`}`);
}
console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
