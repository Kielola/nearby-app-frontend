import { useCallback, useMemo, useState } from 'react';

/**
 * The three text fields on the sign-up / log-in form.
 *
 * ## Why this is its own hook
 *
 * These three values used to live in `useNearbyController`, which is a single
 * 5,800-line hook whose entire return object is published through
 * `NearbyRuntimeContext` as `value={runtime}`.
 *
 * That combination is what made typing lag. React compares context values by
 * identity, and `runtime` is a freshly built object on every render, so it never
 * compares equal. The result: each keystroke in the email field called
 * `setAuthEmailOrPhone`, which re-rendered the top-level `App` component, which
 * re-ran all ~434 declarations in the controller, which produced a new context
 * value, which invalidated every consumer of that context — and the whole
 * application tree re-rendered again. Typing a 16-character email address did
 * that sixteen times.
 *
 * Nothing about the input element was slow. The work per keystroke was the
 * problem.
 *
 * Keeping the field state local to the screen that displays the fields means a
 * keystroke now re-renders that screen and nothing else. The values are handed
 * to the controller at submit time as ordinary function arguments — which,
 * importantly, is how `loginWithEmailOrPhone` already received the email and
 * password in the first place. It had merely been reaching back into global
 * state for the same values in three other places.
 *
 * ## Why the setters are wrapped in useCallback
 *
 * So the returned object is stable across renders. That keeps `useMemo` and
 * `React.memo` effective in anything consuming this hook, and costs nothing.
 */
export interface AuthFormState {
  emailOrPhone: string;
  password: string;
  confirmPassword: string;
  setEmailOrPhone: (value: string) => void;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  /** Clears all three. Called after a successful sign-in and before switching accounts. */
  reset: () => void;
}

export function useAuthFormState(): AuthFormState {
  const [emailOrPhone, setEmailOrPhoneState] = useState('');
  const [password, setPasswordState] = useState('');
  const [confirmPassword, setConfirmPasswordState] = useState('');

  const setEmailOrPhone = useCallback((value: string) => setEmailOrPhoneState(value), []);
  const setPassword = useCallback((value: string) => setPasswordState(value), []);
  const setConfirmPassword = useCallback((value: string) => setConfirmPasswordState(value), []);

  const reset = useCallback(() => {
    setEmailOrPhoneState('');
    setPasswordState('');
    setConfirmPasswordState('');
  }, []);

  return useMemo(
    () => ({
      emailOrPhone,
      password,
      confirmPassword,
      setEmailOrPhone,
      setPassword,
      setConfirmPassword,
      reset,
    }),
    [emailOrPhone, password, confirmPassword, setEmailOrPhone, setPassword, setConfirmPassword, reset],
  );
}
