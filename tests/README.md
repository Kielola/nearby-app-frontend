# Verification tests

Plain `tsx` scripts, no test framework. Each prints a pass/fail table and exits
non-zero on failure, so they work in any CI.

These exist because each one covers a bug that already reached a real device
once. They are the cheapest way to be sure a later change has not brought it
back.

Run all of them:

```bash
npx tsx tests/safari-location.test.ts
npx tsx tests/terms-parser.test.ts
npx tsx tests/ice-servers.test.ts
```

| File | Covers |
|---|---|
| `safari-location.test.ts` | Geolocation on iOS Safari and other browsers that behave unlike Chrome: permission previously denied, cold-GPS timeout, insecure context, no API at all, vague fixes, and the retry ladder that recovers a real fix. Also asserts failure modes are reported with a reason instead of hanging. |
| `terms-parser.test.ts` | Splitting the Terms of Service into 34 sections without altering the text — numbering variants, unnumbered headings, preamble preservation, and that section 34 is locatable for the acknowledgement. |
| `ice-servers.test.ts` | Call connectivity configuration: that a TURN relay is always present, that a configured relay overrides the public fallback, that STUN survives, that a half-configured relay warns instead of failing mysteriously, and that relay-only mode never returns an empty list. |
