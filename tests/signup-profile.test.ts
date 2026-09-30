/**
 * Tests for the registration profile fields.
 *
 * These were previously collected nowhere: a new user gave an email and a
 * password, landed on an empty profile, and had to go find a settings screen to
 * say who they were. The radar filled with people who had no name and nothing in
 * common to match on.
 *
 * Two classes of failure matter here and neither shows up as an error:
 *
 *   1. The answers are collected but never saved — the UI looks fine and the
 *      profile is empty again on reload.
 *   2. The column exists in the schema but not in the migration journal — the
 *      ORM believes it can write the column and every save fails at runtime.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/signup-profile.test.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = join(root, '..', 'nearby-backend');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}
function readBackend(relativePath: string): string {
  return readFileSync(join(backendRoot, relativePath), 'utf8');
}

const {
  getSignupProfile,
  setSignupProfile,
  clearSignupProfile,
  hasSignupProfile,
  signupProfilePayload,
  INTEREST_OPTIONS,
} = await import('../src/features/authentication/signupProfile.ts');

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. The store ────────────────────────────────────────────────────────────
{
  clearSignupProfile();
  check('starts empty', getSignupProfile().displayName === '' && getSignupProfile().age === null);
  check('an empty profile is not worth sending', hasSignupProfile() === false);

  setSignupProfile({ displayName: 'Ada' });
  check('a name is kept', getSignupProfile().displayName === 'Ada');
  check('a name alone is worth sending', hasSignupProfile() === true);

  setSignupProfile({ age: 27 });
  check('age is kept without clobbering the name', getSignupProfile().displayName === 'Ada' && getSignupProfile().age === 27);

  setSignupProfile({ interests: ['Music', 'Tech'] });
  check('interests are kept', getSignupProfile().interests.join(',') === 'Music,Tech');

  setSignupProfile({ streetName: 'Yaba, Lagos' });
  check('the area is kept', getSignupProfile().streetName === 'Yaba, Lagos');

  clearSignupProfile();
  check(
    'clearing resets every field',
    getSignupProfile().displayName === '' &&
      getSignupProfile().age === null &&
      getSignupProfile().interests.length === 0 &&
      getSignupProfile().streetName === '',
  );
}

// ── 2. The payload ──────────────────────────────────────────────────────────
//
// The server rejects an empty PATCH with a 400 by design, so a user who filled in
// only an email and password must not trigger a doomed request.
{
  clearSignupProfile();
  check('an empty profile produces an empty payload', Object.keys(signupProfilePayload()).length === 0);

  setSignupProfile({ displayName: '  Ada  ' });
  check('the name is trimmed', signupProfilePayload().displayName === 'Ada');
  check('a blank-but-present name is omitted', (() => {
    clearSignupProfile();
    setSignupProfile({ displayName: '   ' });
    return signupProfilePayload().displayName === undefined && hasSignupProfile() === false;
  })());

  clearSignupProfile();
  setSignupProfile({ age: 0 });
  check(
    'age 0 is sent, not treated as absent',
    signupProfilePayload().age === 0,
    'a falsy-check would drop a legitimate value',
  );

  clearSignupProfile();
  setSignupProfile({ age: null });
  check('a null age is omitted rather than sent as null', signupProfilePayload().age === undefined);

  clearSignupProfile();
  setSignupProfile({ interests: [] });
  check('no interests sends nothing', signupProfilePayload().interests === undefined);

  clearSignupProfile();
  setSignupProfile({ displayName: 'Ada', interests: ['Music'] });
  const payload = signupProfilePayload();
  check(
    'only the answered fields are sent',
    Object.keys(payload).sort().join(',') === 'displayName,interests',
    Object.keys(payload).join(','),
  );

  check('there is a fixed interest vocabulary', INTEREST_OPTIONS.length >= 8);
  check('interest options are unique', new Set(INTEREST_OPTIONS).size === INTEREST_OPTIONS.length);
}

// ── 3. Subscribers ──────────────────────────────────────────────────────────
{
  clearSignupProfile();
  const { subscribeToSignupProfile } = await import('../src/features/authentication/signupProfile.ts');
  let calls = 0;
  const unsub = subscribeToSignupProfile(() => calls++);

  setSignupProfile({ displayName: 'A' });
  check('a change notifies', calls === 1, `${calls} calls`);

  setSignupProfile({ displayName: 'A' });
  check('an identical write notifies nobody', calls === 1, `${calls} calls — the form re-renders constantly`);

  unsub();
  setSignupProfile({ displayName: 'B' });
  check('an unsubscribed listener stops hearing changes', calls === 1);
  clearSignupProfile();
}

// ── 4. The fields are actually on the form ──────────────────────────────────
{
  const gate = read('src/app/components/AuthGate.tsx');

  check('the form subscribes to the signup store', /useSignupProfile\(\)/.test(gate));
  check('there is a name field', /placeholder="Your name"/.test(gate));
  check('there is an age field', /placeholder="Age"/.test(gate) && /type="number"/.test(gate));
  // The area is no longer a fixed menu. It is detected from where the phone is,
  // and editable, because the old thirteen-item list was a demo list that left
  // anyone outside those cities with no answer to give.
  check(
    'there is an area field',
    /placeholder="Your area"/.test(gate),
  );
  check(
    'the area is detected from location, not chosen from a fixed list',
    /Use my current area/.test(gate) && /reverseGeocode\(/.test(gate),
    'detection is what makes this work for a user in Akure or Jos',
  );
  check(
    'the demo neighbourhood list is gone from registration',
    !/NEIGHBORHOODS/.test(gate),
    'a list that does not contain the user\'s home is worse than no list',
  );
  check(
    'the area stays editable after detection',
    /setSignupProfile\(\{ streetName: e\.target\.value \}\)/.test(gate),
    'detection is sometimes wrong and permission is often denied — an unfixable field traps those users',
  );
  check(
    'detection asks for a coarse fix, not a precise one',
    /enableHighAccuracy: false/.test(gate) && /maximumAge:/.test(gate),
    'we need a neighbourhood, so a fast cached fix is the right trade',
  );
  check(
    'a refused location prompt is handled, not ignored',
    /areaDetection === 'failed'/.test(gate) && /Couldn't get your location/.test(gate),
  );
  check('there are interest chips', /INTEREST_OPTIONS\.map/.test(gate) && /aria-pressed=\{chosen\}/.test(gate));
  check(
    'the fields are on the signup screen only',
    (gate.match(/authScreenState === 'signup'/g) ?? []).length >= 5,
    'a returning user would be asked to re-enter their profile at login',
  );
  check(
    'an empty age box means no answer, not zero',
    /raw === '' \? null : Number\(raw\)/.test(gate),
    'age 0 would be stored for anyone who leaves the box alone',
  );
  check(
    'interest chips are toggleable, not one-shot',
    /signup\.interests\.filter\(\(i\) => i !== interest\)/.test(gate),
    'a chosen interest could never be un-chosen',
  );
}

// ── 5. The answers reach the server ─────────────────────────────────────────
{
  const actions = read('src/features/authentication/hooks/useAuthActions.ts');
  const save = read('src/features/authentication/services/saveSignupProfile.ts');

  check(
    'a name is required to register',
    /if \(!getSignupProfile\(\)\.displayName\.trim\(\)\)/.test(actions),
    'accounts would keep being created with no name',
  );
  check(
    'the profile is saved after the account is created',
    actions.indexOf('createUserWithEmailAndPassword') < actions.indexOf('saveSignupProfile()'),
    'the PATCH needs a live session, so it must come after',
  );
  // Deliberately NOT awaited. It was, and that was wrong: it made registration
  // wait on a second network call to the backend, which on a cold-started
  // instance is several seconds of spinner immediately after creating an account.
  // The account already exists at this point; nothing about finishing sign-up
  // should depend on this request.
  check(
    'the save does not block the sign-up flow',
    /void saveSignupProfile\(\)/.test(actions) && !/await saveSignupProfile\(\)/.test(actions),
    'awaiting it stalls registration behind a cold backend',
  );
  check(
    'a save failure does not look like a failed registration',
    /catch \{[\s\S]*?return false;/.test(save) && !/throw/.test(save),
    'the account exists by then — reporting an error would be a lie',
  );
  check(
    'a failed save keeps the answers',
    save.indexOf('await usersApi.updateMe') < save.indexOf('clearSignupProfile()'),
    'discarding them on failure recreates the empty-profile problem',
  );
}

// ── 6. The backend can actually store them ──────────────────────────────────
//
// The whole feature is a no-op if the column, the DTO and the migration are not
// all present. The migration journal is the one most easily forgotten: the schema
// will happily compile against a column that was never created.
{
  const schema = readBackend('src/database/schema.ts');
  const dto = readBackend('src/users/users.dto.ts');
  const service = readBackend('src/users/users.service.ts');
  const journal = readBackend('src/database/migrations/meta/_journal.json');

  check('the users table has an age column', /age: integer\('age'\)/.test(schema));
  check('the users table has an interests column', /interests: text\('interests'\)\.array\(\)/.test(schema));
  check('PATCH /me accepts age', /age: z\.number\(\)\.int\(\)\.min\(13\)/.test(dto), 'an unbounded age would accept 999');
  check('PATCH /me accepts interests', /interests: z\.array\(z\.string\(\)/.test(dto));
  check('the update actually writes them', /values\.age = patch\.age/.test(service) && /values\.interests = patch\.interests/.test(service));
  check('the public profile returns them', /age: schema\.users\.age/.test(service) && /interests: schema\.users\.interests/.test(service));

  check(
    'the migration file exists',
    /ADD COLUMN IF NOT EXISTS "age" integer/.test(readBackend('src/database/migrations/0013_registration_profile.sql')),
  );
  check(
    'the migration is registered in the journal',
    /"tag":\s*"0013_registration_profile"/.test(journal),
    'a migration absent from the journal NEVER RUNS — the column would not exist and every save would fail',
  );
  check(
    'the migration is additive and idempotent',
    /IF NOT EXISTS/.test(readBackend('src/database/migrations/0013_registration_profile.sql')),
    'a non-idempotent migration breaks a re-run',
  );

  const api = read('src/lib/api/usersApi.ts');
  check('the API payload type includes age and interests', /age\?: number \| null;/.test(api) && /interests\?: string\[\];/.test(api));
  check(
    'the persistence mapper forwards them',
    /payload\.age = patch\.age/.test(read('src/app/hooks/useNearbyController.ts')) &&
      /payload\.interests = patch\.interests/.test(read('src/app/hooks/useNearbyController.ts')),
    'the fields would be collected, sent to the mapper, and silently dropped',
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
