/**
 * Guards the stylesheet, because losing it is completely silent.
 *
 * ## What went wrong
 *
 * `src/index.css` holds Tailwind, the design-system theme tokens and the Inter
 * webfont. It is pulled into the build by ONE line in `src/main.tsx`:
 *
 *     import './index.css';
 *
 * That is a SIDE-EFFECT import — it binds no names. Every other import in the
 * app exists to bring an identifier into scope, so a tool that prunes unused
 * imports checked "is any imported name used?" and got a vacuously false answer.
 * It deleted the line.
 *
 * The result compiled perfectly. `tsc` reported zero errors. All 365 tests
 * passed. The build succeeded and produced a bundle. It simply had no CSS in it
 * — no `dist/assets/*.css`, and no `<link rel="stylesheet">` in `index.html` —
 * so the app shipped unstyled.
 *
 * Nothing in the test suite could have caught that, because every test read the
 * source rather than the build. This file closes that hole from both ends: it
 * checks the import exists, and it checks the tool can never remove it again.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/styling-pipeline.test.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. The stylesheet is wired into the app ─────────────────────────────────
{
  const main = read('src/main.tsx');

  check(
    'main.tsx imports the stylesheet',
    /^\s*import\s+['"]\.\/index\.css['"];?\s*$/m.test(main),
    'this single line is the only thing that puts Tailwind in the build — without it the app ships completely unstyled',
  );
  // main.tsx must actually be the entry the page loads, or importing the CSS
  // there would achieve nothing either.
  const html = read('index.html');
  check(
    'main.tsx is the entry the page loads',
    /<script[^>]+src=["']\/src\/main\.tsx["']/.test(html),
    "the stylesheet import lives in main.tsx, so main.tsx has to be what index.html loads",
  );

  const css = read('src/index.css');
  check('the stylesheet pulls in Tailwind', /@import\s+["']tailwindcss["']/.test(css));
  check(
    'the design-system theme tokens are still defined',
    /@theme\s*\{/.test(css) && /--color-primary/.test(css),
    'the colour palette would be missing even with the import present',
  );
  check(
    'the Inter webfont is still imported',
    /fonts\.googleapis\.com/.test(css),
  );
}

// ── 2. No stylesheet anywhere is orphaned ───────────────────────────────────
//
// The specific failure was main.tsx, but the general rule is what needs
// enforcing: a .css file in src that nothing imports is never built, and nothing
// will ever tell you.
{
  const allFiles = walk(join(root, 'src'));
  const cssFiles = allFiles.filter((f) => f.endsWith('.css'));
  const orphaned: string[] = [];

  for (const cssFile of cssFiles) {
    const base = cssFile.split('/').pop() as string;
    const imported = allFiles.some(
      (f) => /\.(ts|tsx)$/.test(f) && readFileSync(f, 'utf8').includes(base),
    );
    if (!imported) orphaned.push(relative(root, cssFile));
  }

  check(
    'every stylesheet in src/ is imported by something',
    orphaned.length === 0,
    `never built, never linked, no error: ${orphaned.join(', ')}`,
  );
  check('there is at least one stylesheet', cssFiles.length > 0);
}

// ── 3. The import-pruning tool can never repeat this ────────────────────────
{
  const tool = read('tools/strip-unused-imports.mjs');

  check(
    'the pruning tool keeps imports that bind no names',
    /if\s*\(\s*names\.length === 0\s*\)\s*return statementText;/.test(tool),
    'side-effect imports would be judged "unused" and deleted again',
  );
  check(
    'the tool no longer deletes on an empty name list',
    !/return\s+names\.length > 0\s*&&/.test(tool),
    'the original bug: names.length > 0 && ... evaluates false for a bare import, so it returned null (delete)',
  );
  check(
    'the tool explains why, so the guard is not "cleaned up" later',
    /SIDE EFFECT/.test(tool),
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
