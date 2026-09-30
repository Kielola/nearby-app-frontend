// Tailwind, the design-system theme tokens and the Inter webfont all live in
// index.css. This import is what pulls the stylesheet into the build.
//
// It is a SIDE-EFFECT import: it binds no names, so nothing references it and
// no tool can tell it is needed by looking at usage. Deleting it does not error
// — the app compiles perfectly and ships with no CSS at all, which is exactly
// what happened. `tests/styling-pipeline.test.ts` now guards it.
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './app/App.tsx';
import { queryClient } from './lib/api/queryClient';
import { AuthProvider } from './features/authentication/context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
