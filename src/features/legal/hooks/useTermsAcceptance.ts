import { useCallback, useEffect, useState } from 'react';
import { usersApi } from '../../../lib/api/usersApi';
import { TERMS_VERSION } from '../content/termsOfService';

/**
 * Key holding the version this browser last agreed to.
 *
 * Deliberately stores the *version*, not a boolean. A boolean can never answer
 * "agreed to what?", so after any edit to the agreement every existing user
 * would be silently treated as having agreed to the new text. Comparing version
 * strings means a bumped version re-prompts everyone automatically.
 */
const STORAGE_KEY = 'nearby_terms_accepted_version';

function readLocalVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLocalVersion(version: string) {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* Private mode, or storage full. The server record is the one that counts. */
  }
}

export interface TermsAcceptanceState {
  /** True once we know whether agreement is required. */
  resolved: boolean;
  /** True when the user needs to see and accept the terms. */
  needsAcceptance: boolean;
  /** True while the acceptance is being written to the server. */
  submitting: boolean;
  /** Set when the server write failed, for display. */
  error: string | null;
  /** Record agreement. Resolves true when the server has it. */
  accept: () => Promise<boolean>;
}

/**
 * Tracks whether the signed-in user has accepted the current terms.
 *
 * ## Ordering matters here
 *
 * The local cache is consulted FIRST, and only a miss triggers a network call.
 * This screen sits in front of registration, so a blocking round trip on every
 * single visit — including for users who agreed months ago — would add a visible
 * delay to the one flow where a new user's patience is shortest.
 *
 * ## Why a local cache is not sufficient on its own
 *
 * The cache decides *whether to prompt*. It is never the evidence. If it were,
 * agreement would be something any user could revoke by clearing browser
 * storage, and the record would not survive a reinstall or a new device. So
 * `accept()` always writes to the backend, and the local value is only written
 * after the server confirms. A failed write leaves the local cache untouched so
 * the prompt reappears rather than silently recording agreement that was never
 * stored.
 */
export function useTermsAcceptance(userId: string | null | undefined): TermsAcceptanceState {
  const [resolved, setResolved] = useState(false);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setResolved(true);
      setNeedsAcceptance(false);
      return;
    }

    const local = readLocalVersion();
    if (local === TERMS_VERSION) {
      setNeedsAcceptance(false);
      setResolved(true);
      return;
    }

    // Not cached for this version. Ask the server before re-prompting — the
    // user may have agreed on another device, and re-showing a long agreement
    // to someone who already agreed is a good way to lose them at sign-up.
    let cancelled = false;

    (async () => {
      try {
        const me = await usersApi.getMe();
        if (cancelled) return;

        if (me?.termsAcceptedVersion === TERMS_VERSION) {
          // Agreed elsewhere — cache it so we do not ask again on this device.
          writeLocalVersion(TERMS_VERSION);
          setNeedsAcceptance(false);
        } else {
          setNeedsAcceptance(true);
        }
      } catch {
        // Could not reach the server. Prompt rather than assume agreement:
        // silently proceeding would record nothing at all, leaving the user
        // with no acceptance on file for a document they never saw.
        if (!cancelled) setNeedsAcceptance(true);
      } finally {
        if (!cancelled) setResolved(true);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const accept = useCallback(async (): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      // The server stamps the timestamp itself; we send only the version we
      // displayed. See the note on the backend's acceptTermsSchema.
      await usersApi.acceptTerms(TERMS_VERSION);
      writeLocalVersion(TERMS_VERSION);
      setNeedsAcceptance(false);
      return true;
    } catch (err: any) {
      setError(
        err?.message ||
          'We could not record your acceptance. Check your connection and try again.',
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { resolved, needsAcceptance, submitting, error, accept };
}

/** Test seam — removes the cached acceptance. */
export function clearTermsAcceptanceCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
