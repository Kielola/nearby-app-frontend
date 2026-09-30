#!/usr/bin/env node
/**
 * Strip unused imports from the duplicated preamble.
 *
 * ## The problem
 *
 * Fifteen components open with the *same* 129-line import block, differing only in
 * the component name on the last line. `BottomNav` imports ExploreTab (2,517
 * lines), PremiumChatRoom (1,680), PremiumProfileView (1,690), GoogleMapIntegration
 * (1,302), the whole Google Maps library, the whole Firebase surface and ~80 lucide
 * icons — and uses none of them.
 *
 * The consequences for speed, which is why this matters:
 *
 *   - Every component drags ~10,000 lines of unrelated modules through the graph.
 *   - Circular imports (`BottomNav → ExploreTab → … → BottomNav`) slow module init.
 *   - In dev, Vite transforms all of it on every reload — most of the perceived lag.
 *   - `sideEffects` is not declared, so many of these ship to users.
 *
 * ## What this does
 *
 * For each file, keeps an import only if at least one of its imported *local* names
 * appears in the file body. Removes individual names from a multi-name import when
 * only some are used. Drops a statement entirely when none are.
 *
 * Then it prints a diff-sized summary so the change is reviewable, and relies on
 * `tsc` plus the test suite to prove nothing broke — this script is deliberately
 * conservative, and the compiler is the referee.
 *
 * Usage:
 *   node tools/strip-unused-imports.mjs --dry    # report only
 *   node tools/strip-unused-imports.mjs          # write changes
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const DRY = process.argv.includes('--dry');
const ROOT = process.cwd();

/** Walk a directory for .ts/.tsx files. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Split a source file into its import region and the body.
 *
 * The region ends at the first line that is neither blank, a comment, nor part of
 * an import statement. That is precise enough for this codebase, where every file
 * opens with imports followed immediately by code.
 */
function splitImports(source) {
  const lines = source.split('\n');
  let i = 0;
  let depth = 0;

  for (; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (depth > 0) {
      // Inside a multi-line import: track braces until it closes.
      depth += (line.match(/\{/g) ?? []).length;
      depth -= (line.match(/\}/g) ?? []).length;
      continue;
    }
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }
    if (trimmed.startsWith('import ')) {
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      if (opens > closes) depth = opens - closes;
      continue;
    }
    break;
  }

  return { header: lines.slice(0, i).join('\n'), body: lines.slice(i).join('\n') };
}

/**
 * Break an import region into individual statements, line by line.
 *
 * Deliberately NOT a regex over the whole header. The first attempt used
 * `/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm`, which silently mis-parsed
 * every file: `\s*` matches newlines, so the trailing `\s*$` let a match run past
 * the end of its own statement and the whole header collapsed into one unusable
 * blob. The symptom was the worst kind — the tool reported success, changed 47
 * unrelated files, and skipped all fifteen files it was written for.
 *
 * A statement here is: consecutive lines beginning at `import`, ending at the
 * first line containing a module specifier (`from '...'`). That is exactly how
 * every import in this codebase is written, so it is precise and readable.
 */
function parseStatements(header) {
  const statements = [];
  const lines = header.split('\n');

  let buffer = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (buffer.length === 0 && !trimmed.startsWith('import ')) continue;

    buffer.push(line);

    // A statement is complete once it names its module.
    if (/from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed) || /^import\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
      statements.push({ text: buffer.join('\n'), start: 0, end: 0 });
      buffer = [];
    }
  }

  return { statements, trailing: '' };
}

/** The local names an import statement binds, so usage can be tested per name. */
function localNames(statementText) {
  const names = [];
  const clause = statementText
    .replace(/^import\s+/, '')
    .replace(/\s*from\s+['"][^'"]+['"];?\s*$/, '')
    .trim();

  const braces = clause.match(/\{([\s\S]*)\}/);
  const outside = clause.replace(/\{[\s\S]*\}/, '').replace(/,\s*$/, '').trim();

  // Default import — the bare identifier before any braces.
  if (outside && !outside.startsWith('*')) {
    names.push(outside.split(/\s+as\s+/).pop().trim());
  }
  // Namespace import — `* as ns`.
  const ns = outside.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (ns) names.push(ns[1]);

  if (braces) {
    for (const part of braces[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      names.push(trimmed.split(/\s+as\s+/).pop().trim());
    }
  }

  return names.filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
}

/** Is this local name referenced anywhere in the body? */
function isUsed(name, body) {
  return new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(body);
}

/** Rebuild a `{ ... }` import keeping only the named specifiers still used. */
function pruneBraced(statementText, body) {
  // Type-only imports are left completely alone.
  //
  // Two reasons, and the second is the important one:
  //
  //   1. They are erased at compile time, so pruning them saves nothing at
  //      runtime. There is no performance argument for touching them.
  //   2. Rewriting them is a minefield. Dropping the `type` modifier turns a
  //      type import into a value import and every reference fails with
  //      "Cannot find name". Rebuilding one that has BOTH a default and named
  //      bindings produces `import type X, { Y }`, which TypeScript rejects
  //      outright (TS1363). Between the two, an earlier version of this script
  //      broke 20 files while trying to optimise something that costs nothing.
  if (/^import\s+type\s/.test(statementText.trim())) return statementText;

  const braces = statementText.match(/\{([\s\S]*)\}/);
  if (!braces) {
    // Default or namespace import: keep it or drop it whole.
    const names = localNames(statementText);
    // NEVER remove a statement that imports no names.
    //
    // `import './index.css';` binds nothing, so "is any imported name used?" is
    // vacuously false and it looked like dead code. It is not dead code — it is
    // a SIDE EFFECT, and the import IS the usage. Removing it compiles cleanly,
    // passes every test, and ships an app with no stylesheet.
    //
    // Anything with no bindings is kept unconditionally. That is the only safe
    // rule: nothing in the file can tell us whether the side effect matters.
    if (names.length === 0) return statementText;

    return names.some((n) => isUsed(n, body)) ? statementText : null;
  }

  const keep = braces[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((spec) => {
      // `type Foo` / `type Foo as Bar` — the local name is the final token.
      const local = spec.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      return isUsed(local, body);
    });

  // Order matters. Removing the module specifier AFTER trimming the comma left a
  // dangling `React,`, which reassembled as `import React,, { ... }` — a syntax
  // error in 14 files. Strip the specifier first, then the comma it left behind.
  const outside = statementText
    .replace(/^import\s+/, '')
    .replace(/\{[\s\S]*\}/, '')
    .replace(/\s*from\s+['"][^'"]+['"];?\s*$/, '')
    .replace(/,\s*$/, '')
    .trim();

  const spec = statementText.match(/from\s+(['"][^'"]+['"]);?\s*$/);
  if (!spec) return null;
  const specifier = spec[1];

  // Keep a default/namespace import only if it is still referenced.
  const outsideUsed = outside && localNames(`import ${outside} from ${specifier}`).some((n) => isUsed(n, body));

  if (keep.length === 0 && !outsideUsed) return null;

  const parts = [];
  if (outsideUsed && outside) parts.push(outside);
  if (keep.length > 0) parts.push(`{ ${keep.join(', ')} }`);

  return `import ${parts.join(', ')} from ${specifier};`;
}

// ── Run ─────────────────────────────────────────────────────────────────────

const files = walk(join(ROOT, 'src'));
let touched = 0;
let linesRemoved = 0;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const { header, body } = splitImports(source);

  if (!header.includes('import ')) continue;

  const { statements, trailing } = parseStatements(header);
  if (statements.length === 0) continue;

  const kept = [];
  let removedHere = 0;

  for (const stmt of statements) {
    const pruned = pruneBraced(stmt.text, body);
    const originalNames = localNames(stmt.text).length;
    const keptNames = pruned ? localNames(pruned).length : 0;

    if (!pruned) {
      removedHere += stmt.text.split('\n').length;
    } else {
      if (keptNames < originalNames) removedHere += 1;
      kept.push(pruned);
    }
  }

  if (removedHere === 0) continue;

  // Preserve any comments from the original header so explanations survive.
  const headerComments = header
    .split('\n')
    .filter((l) => l.trim().startsWith('//') || l.trim().startsWith('/*') || l.trim().startsWith('*'))
    .join('\n');

  const newHeader = (headerComments ? headerComments + '\n' : '') + kept.join('\n') + '\n\n';
  const rebuilt = newHeader + body.replace(/^\n+/, '');

  if (rebuilt === source) continue;

  touched += 1;
  const before = source.split('\n').length;
  const after = rebuilt.split('\n').length;
  linesRemoved += before - after;

  const rel = relative(ROOT, file);
  const symbolsBefore = statements.reduce((n, s) => n + localNames(s.text).length, 0);
  const symbolsAfter = kept.reduce((n, s) => n + localNames(s).length, 0);
  console.log(
    `  ${rel.padEnd(58)} ${String(symbolsBefore).padStart(3)} → ${String(symbolsAfter).padStart(3)} imports   ${String(before).padStart(5)} → ${String(after).padStart(5)} lines`,
  );

  if (!DRY) writeFileSync(file, rebuilt);
}

console.log(
  `\n  ${DRY ? '[dry run] ' : ''}${touched} file(s) changed, ${linesRemoved} lines removed\n`,
);
