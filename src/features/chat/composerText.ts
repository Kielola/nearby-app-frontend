/**
 * The chat composer's in-progress text, held outside the app's root state.
 *
 * ## The problem this solves
 *
 * This value used to be a `useState` inside `useNearbyController` — a hook called
 * at the very root of the tree, whose ~300-key return value is handed to a single
 * context consumed by the entire app shell.
 *
 * The consequence was that typing one character into the chat box did this:
 *
 *     one keystroke
 *       -> setTextInput, which lives at the app root
 *       -> App re-renders
 *       -> a brand-new 300-key context object is built
 *       -> all 20 consumers re-render
 *       -> every tab, every modal, the nav bar, the header and the map re-render
 *
 * Per character. That was the app's worst lag, and it was not a slow function
 * anywhere — it was the whole app re-rendering on every keypress.
 *
 * The text you have typed but not yet sent is, by definition, local to the
 * composer. Nothing outside the chat needs it. Keeping it in the root state was
 * the mistake.
 *
 * ## Why a store and not a context
 *
 * A React context would need a provider mounted somewhere above the chat. Get
 * that placement wrong and the value silently disappears — or, worse, the
 * provider sits high enough that it re-renders everything anyway. A module-level
 * store with `useSyncExternalStore` has no mounting requirement at all: a
 * component either subscribes and re-renders, or does not subscribe and is not
 * touched. There is no placement to get wrong.
 *
 * This follows the same pattern as `features/referrals/pendingCode.ts`, which the
 * codebase already uses for cross-cutting state that must not live in the root.
 *
 * ## The setter is a drop-in for `useState`
 *
 * `setComposerText` accepts either a value or an updater function, exactly like
 * React's own setter:
 *
 *     setComposerText('hello');
 *     setComposerText((prev) => prev + '👋');
 *
 * That is deliberate. Every existing call site — the emoji picker, the emoji
 * autocomplete, the text field, the clear-after-send — was written against
 * `useState` and continues to work with no change to its logic. A refactor that
 * touched the behaviour of twenty call sites would be a refactor that broke one
 * of them.
 */

import { useSyncExternalStore } from 'react';

let composerText = '';
const listeners = new Set<() => void>();

/** The current text. For non-React code (the send path) that needs it now. */
export function getComposerText(): string {
  return composerText;
}

export type SetComposerText = (value: string | ((prev: string) => string)) => void;

/**
 * Replace the composer text, or update it from its previous value.
 *
 * Notifies subscribers only when the value actually changes, so re-entering the
 * same string — which React does routinely on re-render — costs nothing.
 */
export function setComposerText(value: string | ((prev: string) => string)): void {
  const next = typeof value === 'function' ? value(composerText) : value;
  if (next === composerText) return;

  composerText = next;
  for (const listener of listeners) listener();
}

/** Clear it. Used when a chat closes or the user signs out. */
export function clearComposerText(): void {
  setComposerText('');
}

export function subscribeToComposerText(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Subscribe a component to the composer text.
 *
 * Only call this inside the chat UI. Calling it high in the tree — in the root
 * controller, for instance — would put the keystroke back on the critical path
 * and undo the entire point of this module.
 */
export function useComposerText(): [string, SetComposerText] {
  const value = useSyncExternalStore(
    subscribeToComposerText,
    getComposerText,
    // Server snapshot: there is no composer before hydration. Returning the same
    // empty string keeps the server and first client render identical.
    getComposerText,
  );

  return [value, setComposerText];
}
