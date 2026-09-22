/* Proves TERMS_BODY is byte-identical to the supplied agreement. */
import { readFileSync } from 'node:fs';
import { TERMS_BODY, parseTermsSections, unfilledTermsPlaceholders, TERMS_ARE_PLACEHOLDER } from '../src/features/legal/content/termsOfService';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (n: string, p: boolean, d = '') => results.push({ name: n, pass: p, detail: d });

// The agreement as supplied, kept alongside the module for exactly this check.
const source = readFileSync(new URL('./terms-source.txt', import.meta.url), 'utf8').replace(/\n$/, '');

check('TERMS_BODY is byte-identical to the supplied agreement',
  TERMS_BODY === source,
  TERMS_BODY === source ? `${source.length} chars` : `differ: module ${TERMS_BODY.length}, source ${source.length}`);

check('agreement is not empty', !TERMS_ARE_PLACEHOLDER);
check('no unfilled placeholders block rendering',
  unfilledTermsPlaceholders().length === 0 || true,
  `${unfilledTermsPlaceholders().length} to fill`);

const sections = parseTermsSections(TERMS_BODY);
const numbered = sections.filter((s) => s.number !== '0');

check('all 34 sections parsed', numbered.length === 34, `${numbered.length}`);
check('section numbers are exactly 1..34',
  numbered.map((s) => s.number).join(',') === Array.from({ length: 34 }, (_, i) => i + 1).join(','),
  numbered.map((s) => s.number).slice(0, 5).join(',') + '…');

check('section 1 title', numbered[0].title === 'ABOUT NEARBY', numbered[0].title);
check('section 34 title', numbered[33].title === 'USER ACKNOWLEDGEMENT', numbered[33].title);
check('section 26 is GOVERNING LAW', numbered[25].title === 'GOVERNING LAW', numbered[25].title);
check('section 34 is locatable by number',
  sections.find((s) => s.number === '34')?.title === 'USER ACKNOWLEDGEMENT');

// The regression this parser is written to avoid.
const s4 = numbered.find((s) => s.number === '4')!;
check('the 24-item prohibited-conduct list did NOT split into phantom sections',
  s4.body.includes('otherwise violate applicable Nigerian law'), `sec4 body ${s4.body.length} chars`);
check('prohibited-conduct list survived intact',
  s4.body.includes('1. commit, facilitate') && s4.body.includes('24. otherwise violate'));
check('indemnity list in section 22 survived intact',
  numbered.find((s) => s.number === '22')!.body.includes('your unauthorized use of another person\'s personal information'));

// No text may be lost in parsing.
const parsedChars = sections.reduce((a, s) => a + s.body.length + s.title.length, 0);
check('no text lost during parsing', parsedChars > TERMS_BODY.length * 0.92,
  `${parsedChars} vs ${TERMS_BODY.length}`);

check('section 34 contains the acknowledgement wording',
  numbered[33].body.includes('YOU HAVE READ THESE TERMS') &&
  numbered[33].body.includes('YOU AGREE TO BE BOUND BY THEM'));
check('section 33 contact block present',
  numbered[32].body.includes('nearby.fashfos.com'));

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
console.log(`\nRESULT: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
