import { useEffect } from 'react';

/**
 * Applying the light/dark preference
 *
 * Writes the choice to localStorage and follows the operating system when the user has picked 'system', including when the OS setting changes while the app is open.
 *
 * Every value this block reads is declared in `UseAppearanceModeEffectDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseAppearanceModeEffectDeps {
  appearanceMode: any;
  setAppTheme: any;
}

export function useAppearanceModeEffect(deps: UseAppearanceModeEffectDeps) {
  const {
  
    appearanceMode,
    setAppTheme,} = deps;

useEffect(() => {
  localStorage.setItem('appearanceMode', appearanceMode);
  if (appearanceMode === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      const themeVal = e.matches ? 'dark' : 'light';
      setAppTheme(themeVal);
      if (themeVal === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    updateTheme(mediaQuery);
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  } else {
    setAppTheme(appearanceMode);
    if (appearanceMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}, [appearanceMode]);
}

export default useAppearanceModeEffect;
