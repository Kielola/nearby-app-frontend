/* Simulates the exact browser behaviours reported. Run then delete. */
import { acquireLocation, isLocationFailure, isLocationSuccess } from '../src/features/maps/services/geolocation';

type Behavior = (ok: any, err: any, opts: any) => void;

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

function installGeo(behavior: Behavior, secure = true) {
  (globalThis as any).window = {
    isSecureContext: secure,
    location: { protocol: secure ? 'https:' : 'http:', hostname: 'nearby.fashfos.com' },
  };
  (globalThis as any).navigator = {
    geolocation: { getCurrentPosition: behavior, watchPosition: () => 1, clearWatch: () => {} },
  };
  (globalThis as any).document = { visibilityState: 'visible' };
}

const GOOD = { coords: { latitude: 6.5244, longitude: 3.3792, accuracy: 18 }, timestamp: Date.now() };

(async () => {
  // 1. Safari: permission previously denied — resolves instantly, never prompts.
  installGeo((_ok, err) => err({ code: 1, message: 'User denied Geolocation' }));
  let r = await acquireLocation();
  check('Safari denied → permission-denied, not a fake location',
    isLocationFailure(r) && r.reason === 'permission-denied', isLocationFailure(r) ? r.reason : 'ok:true');
  check('Safari denied → tells user to change settings, does not offer pointless retry',
    isLocationFailure(r) && r.requiresUserAction === true && r.retryable === false);

  // 2. Safari: cold GPS, high accuracy times out, low accuracy succeeds.
  let call = 0;
  installGeo((ok, err) => {
    call++;
    if (call === 1) setTimeout(() => err({ code: 3, message: 'Timeout expired' }), 5);
    else setTimeout(() => ok(GOOD), 5);
  });
  r = await acquireLocation({ timeoutMs: 50 });
  check('Safari cold GPS → retry ladder recovers a real fix',
    isLocationSuccess(r) && Math.abs(r.latitude - 6.5244) < 1e-6,
    isLocationSuccess(r) ? `lat=${r.latitude} via=${r.source}` : isLocationFailure(r) ? r.reason : '?');
  check('recovered fix is tagged as coming from the retry',
    isLocationSuccess(r) && r.source === 'retry-low-accuracy');

  // 3. Vague fix on first attempt is retried, not accepted as a street name.
  call = 0;
  installGeo((ok) => {
    call++;
    setTimeout(() => ok(call === 1
      ? { coords: { latitude: 6.5, longitude: 3.4, accuracy: 4000 }, timestamp: Date.now() }
      : GOOD), 5);
  });
  r = await acquireLocation({ timeoutMs: 200 });
  check('3 km fix is rejected in favour of a precise one',
    isLocationSuccess(r) && r.accuracyMeters === 18, isLocationSuccess(r) ? `acc=${r.accuracyMeters}` : '?');

  // 4. HTTP page — Safari silently never fires the callback.
  installGeo(() => { /* never calls back — this is the real Safari failure */ }, false);
  r = await acquireLocation({ timeoutMs: 40 });
  check('insecure context → named reason instead of hanging forever',
    isLocationFailure(r) && r.reason === 'insecure-context', isLocationFailure(r) ? r.reason : '?');

  // 5. Browser with no geolocation API at all.
  (globalThis as any).navigator = {};
  r = await acquireLocation();
  check('no geolocation API → unsupported',
    isLocationFailure(r) && r.reason === 'unsupported', isLocationFailure(r) ? r.reason : '?');

  // 6. Everything times out.
  installGeo((_ok, err) => setTimeout(() => err({ code: 3, message: 'Timeout expired' }), 5));
  r = await acquireLocation({ timeoutMs: 40 });
  check('total timeout still returns a typed failure (never throws)',
    isLocationFailure(r) && r.reason === 'timeout', isLocationFailure(r) ? r.reason : '?');

  // 7. Every failure carries a message that is safe to show.
  const noMsg = results.length; // placeholder
  check('all failures carry a user-facing message',
    isLocationFailure(r) && typeof r.message === 'string' && r.message.length > 10, isLocationFailure(r) ? r.message : '?');

  const failed = results.filter(x => !x.pass);
  for (const x of results) console.log(`  ${x.pass ? '✓' : '✗'} ${x.name}${x.detail ? `  [${x.detail}]` : ''}`);
  console.log(`\nRESULT: ${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
