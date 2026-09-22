/*
 * Parser edge cases for the Terms of Service splitter.
 *
 * The real document is covered by terms-fidelity.test.ts; this file is for the
 * shapes a future edit might introduce, so a small formatting change cannot
 * silently break the consent screen's section lookup.
 */
import { parseTermsSections, TERMS_BODY } from '../src/features/legal/content/termsOfService';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (n: string, p: boolean, d = '') => results.push({ name: n, pass: p, detail: d });

// The real document — the format that actually ships.
const real = parseTermsSections(TERMS_BODY);
const numbered = real.filter((s) => s.number !== '0');
check('real document yields 34 sections', numbered.length === 34, `${numbered.length}`);
check('section 34 is findable', !!real.find((s) => s.number === '34'));
check('preamble kept as unit 0', real[0].number === '0', real[0]?.number ?? 'none');

// A section body must include its own numbered list, not be split by it.
const listy = parseTermsSections(
  ['4. USER CONDUCT', '', 'You must not:', '', '1. commit a crime;', '2. harass anyone;', '24. otherwise violate law.', '', 'Afterwards.'].join('\n'),
);
check('lower-case numbered list is NOT treated as headings',
  listy.length === 1 && listy[0].body.includes('24. otherwise violate law.'), `${listy.length} section(s)`);

// Two-digit section numbers.
const many = parseTermsSections(
  Array.from({ length: 34 }, (_, i) => `${i + 1}. SECTION NUMBER ${i + 1}\n\nBody ${i + 1}.`).join('\n\n'),
);
check('numbers 1..34 all parsed', many.filter((s) => s.number).length === 34, `${many.length}`);
check('numbering survives two digits', many[33]?.number === '34', many[33]?.number ?? 'none');

// Headings the document does not currently use, but a future edit might.
const variants = parseTermsSections(['1. ABOUT NEARBY', 'x', '12. MESSAGES AND COMMUNICATIONS', 'y'].join('\n'));
check('multi-word upper-case titles captured',
  variants[1]?.title === 'MESSAGES AND COMMUNICATIONS', variants[1]?.title ?? 'none');

// Things that must NOT become sections.
const negatives = parseTermsSections(['- copy;', 'lowercase heading', '3. lower case title', 'x'].join('\n'));
check('bullets and lower-case lines are not headings',
  negatives.filter((s) => s.number && s.number !== '0').length === 0,
  negatives.filter((s) => s.number).map((s) => s.number).join(','));

check('empty input yields nothing', parseTermsSections('').length === 0);

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
console.log(`\nRESULT: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
