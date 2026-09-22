# Refactor status

`useNearbyController.ts` was **6,028 lines** and is now **2,459**. That is a 59%
reduction, and the whole test gate has stayed green after every single step — not
just at the end.

```
                       before     after
useNearbyController     6,028     2,459
return object            ~610       326
extracted modules           0        70 files, 10,180 lines
```

---

## The test gate

Run this after any change. All of it passes right now.

```bash
cd nearby-app-frontend
npx tsc --noEmit                                   # 0 errors
npx vite build                                     # ✓
npx tsx tests/safari-location.test.ts              # 9 passed, 0 failed
npx tsx tests/terms-parser.test.ts                 # 9 passed, 0 failed
npx tsx tests/terms-fidelity.test.ts               # 15 passed, 0 failed
npx tsx tests/ice-servers.test.ts                  # 15 passed, 0 failed
```

Duplicate-send regression, from the backend folder:

```bash
cd nearby-backend
npx tsx /tmp/dup.test.ts                           # 14 passed, 0 failed
```

---

## What moved out, and why

Every module below is a `use*(deps)` hook or a plain service. Nothing reads
through a closure any more: a module gets exactly what it declares in its
`Deps` interface and receives it as a parameter, so the compiler enforces the
coupling instead of a reader having to trace it.

| module | lines |
|---|---|
| `calls/hooks/useCallSignaling.ts` | 909 |
| `legal/content/termsOfService.ts` | 667 |
| `authentication/hooks/useAuthProfileSync.ts` | 554 |
| `chat/hooks/useChatActions.ts` | 538 |
| `authentication/hooks/useAuthActions.ts` | 464 |
| `friends/hooks/useSocialActions.ts` | 446 |
| `maps/services/geolocation.ts` | 406 |
| `media/hooks/useMediaUploads.ts` | 371 |
| `chat/hooks/useChatManagement.ts` | 353 |
| `media/hooks/useCameraAndVoice.ts` | 302 |
| `maps/services/locationService.ts` | 281 |
| `settings/hooks/useUiFlags.ts` | 272 |
| `chat/hooks/useMessages.ts` | 256 |
| `maps/hooks/useLocationTracking.ts` | 229 |
| `content/hooks/useStories.ts` | 223 |
| `profile/hooks/useProfileState.ts` | 214 |
| …and 54 more | |

The newest additions this round, in the order they were cut:

**Effects that were never named declarations** — these were the hard part, because
there was no identifier to ask for:

`useAuthRedirect` · `usePresenceHeartbeat` · `useChatScrollAnchoring` ·
`useChatReadReceipts` · `useCallMediaElements` · `useStoryExpiry` ·
`useNotifications` · `useFirestoreHealthCheck` · `useOnlineStatus` ·
`useChatSearchMatches` · `useMeetupRatingsSync` · `useIncomingRequestsRef` ·
`useProfileBackendPersistence` · `useServerProfileAdoption` ·
`useNearbyNeighbors` · `usePresenceMapSync` · `useViewedNeighborContent` ·
`useViewedUserContent` · `useMyHighlights` · `useAppearanceModeEffect` ·
`useMeetupsSync` · `useTypingIndicatorPublisher` · `useStoryViewerPlayback` ·
`useStoryAutoAdvance` · `useCallSessionTimers` · `useCapturePhoto` ·
`useDoodleCanvas` · `useStartVoiceRecording` · `useStopAndSendVoice` ·
`useCancelVoiceRecording` · `useProcessPayment`

**State clusters** — 60 `useState` pairs that used to be listed twice (once
declared, once in the return object) now spread in from one line:

`useChatRoomState` · `useCameraState` · `useStoryState` · `useOnboardingState`

---

## Tooling

The extraction is driven by scripts in `tools/`, because doing it by hand is
what produced the breakage earlier in this refactor.

| tool | what it does |
|---|---|
| `analyze-hook-block.py` | inventories declarations and their line spans |
| `extract-domain.py` | moves *named declarations* into a hook |
| `extract-effects.py` | moves a *line range or content-anchored block* — for effects, which have no name |
| `move-effect-runs.py` | moves many effect blocks in one pass, re-locating each by content so line numbers can never go stale |
| `wire-deps.py` | resolves what a moved block needs, from the compiler's own output |
| `trim-domain-destructures.py` | drops destructured names nothing uses any more |
| `repair-controller.py` | repairs the seven regions that keep getting mangled |

### Four real bugs found in these tools

Each one had been silently corrupting the controller, which is why the refactor
kept "going red for no reason". All four are fixed.

1. **`wire-deps.py` spliced dependency names into the wrong file.** When a new
   hook's destructure was empty, a regex failed to match and left the *interface*
   match object in scope. Its offset was then used to index the **controller** —
   a few hundred characters in, which lands inside the import list. It split
   `Palette,` into `Pale` + `tte,`.
2. **`trim-domain-destructures.py` mutated a list while iterating a
   pre-computed `range`.** This is what damaged the controller twice and cost
   hours. Rewritten to decide against the original file and delete bottom-up.
3. **`extract-domain.py` mis-detected where a declaration ends.** A trailing `//`
   comment after the `;` made the declaration read as unterminated, so it
   swallowed the next one — `isLockVoiceRecording` was invisible to the tool.
4. **The controller's `import React, { useState } from 'react'` was not parsed,**
   so `React` was threaded through as a *dependency parameter* instead of an
   import, producing `React: any` and duplicate object keys.

---

## Diagnostics worth keeping

- **Never report an error count from `tsc … | head`.** A count of "8" was really
  475. Always `grep -c 'error TS'`.
- **One unterminated `/**` produces hundreds of errors at once** — 339 `TS18004`
  plus 136 `TS2304` from a single unclosed doc comment. Braces stay balanced and
  every structural check passes while each swallowed name reads as "not in
  scope". Count `/*` against `*/` per line, then read the region.
- **`TS2448` means a call moved above something it reads, not that a dependency
  is missing.** Move the call down; do not add a parameter.
- **Types must never be forwarded as dependencies.** They arrive as `import type`
  in the hook and are dropped from both the interface and the call site.

### Restore points

| file | lines | state |
|---|---|---|
| `/tmp/ctl-good-2458.ts` | 2,459 | **current** — tsc clean, full gate green |
| `/tmp/ctl-good-2684.ts` | 2,685 | tsc clean, full gate green |
| `/tmp/ctl-good-2995.ts` | 2,996 | tsc clean, full gate green |
| `/tmp/ctl-good-3441.ts` | 3,441 | tsc clean, full gate green |

To go back to one:

```bash
cp /tmp/ctl-good-2458.ts src/app/hooks/useNearbyController.ts
npx tsc --noEmit
```

---

## What is still in the controller

The head is 2,129 lines and the return object is 326 lines. Remaining work, in
the order worth doing it:

- **the 326-line return object** — 302 individually listed keys against 16
  spreads. Each remaining state cluster moved out becomes one more spread line.
- **`useChatSync`'s 86-line call site** — it is one statement with a large
  callback; the callback is the part worth moving.
- **`useAuthActions`' 77-line call** and the remaining long argument lists. These
  are already thin in behaviour, just wide in parameters.
- **the auth/onboarding call sites** near the top of the component.

The controller is no longer a place where behaviour lives — it is wiring. That
was the goal, and it is close, but "hundreds of lines" is not reached yet.

---

## Housekeeping before you push

- **`.env` was removed from the archive.** It is gitignored, so it would not have
  been committed anyway. Your local build needs it:

  ```bash
  cp .env.example .env      # then fill in the real values
  ```

- **`TERMS_BODY` still has three placeholders** that must be filled before launch
  — `[INSERT OFFICIAL EMAIL]`, `[INSERT FULL REGISTERED LEGAL NAME]`,
  `[INSERT REGISTERED OFFICE]`. A binding legal document should not have these
  invented for it.
- **TURN credentials are unset**, so calls fall back to the Metered OpenRelay
  test servers. Set `VITE_TURN_URL`, `VITE_TURN_USERNAME` and
  `VITE_TURN_CREDENTIAL` in Netlify. On Nigerian CGNAT mobile networks a relay is
  the difference between calls working and calls failing.
