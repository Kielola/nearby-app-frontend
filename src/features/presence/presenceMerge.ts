/**
 * Merging the realtime online/offline feed into the map the UI reads.
 *
 * Extracted from the hook so the logic can be tested directly. It is worth its
 * own file: getting it wrong has twice the usual cost here, because a wrong
 * return value does not just show wrong data — it decides whether the app
 * re-renders at all.
 *
 * ## The rule that matters
 *
 * When nothing has actually changed, this returns the **identical object** it was
 * given. That is not tidiness. React compares state with `Object.is` and skips the
 * re-render when the reference is unchanged. Returning a fresh copy that happens
 * to contain the same values re-renders the entire application for nothing — and
 * because the presence map lives at the app root and is consumed by a context
 * every screen subscribes to, "the entire application" is literal.
 *
 * A version of this that always returned a new object, fed by a hook that handed
 * back a new empty object on every call, produced an endless render loop: effect
 * → setState → render → effect. It pinned the CPU and made the app feel broken,
 * worst of all for a newly registered account, which has no neighbours to watch
 * and so never got past the empty case.
 */

export interface PresenceEntry {
  online: boolean;
  status: 'active' | 'away' | 'offline';
  typing: string;
  lastSeen: string;
  currentConversation: string;
}

export type PresenceMap = Record<string, PresenceEntry>;

/**
 * Fold `onlineStatusByUserId` into `prev`.
 *
 * @returns `prev` itself when nothing changed, so callers can hand it straight to
 *          a state setter and have React skip the re-render.
 */
export function mergePresenceMap(
  prev: PresenceMap,
  onlineStatusByUserId: Record<string, boolean>,
): PresenceMap {
  const entries = Object.entries(onlineStatusByUserId);
  if (entries.length === 0) return prev;

  const next: PresenceMap = { ...prev };
  let changed = false;

  for (const [userId, isOnline] of entries) {
    const existing = next[userId];
    const status: PresenceEntry['status'] = isOnline ? 'active' : 'offline';

    // Nothing about this user moved — leave the map alone entirely.
    if (existing && existing.online === isOnline && existing.status === status) continue;

    changed = true;
    next[userId] = {
      online: isOnline,
      status,
      // Preserve what the richer sources (chat + call signalling) already know.
      // This feed only carries online/offline, so replacing the whole entry would
      // wipe a live "typing…" indicator or a last-seen stamp.
      typing: existing?.typing || '',
      lastSeen: existing?.lastSeen || '',
      currentConversation: existing?.currentConversation || '',
    };
  }

  return changed ? next : prev;
}
