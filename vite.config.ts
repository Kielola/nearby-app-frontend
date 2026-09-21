import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Fail the BUILD, not the browser.
//
// Every VITE_* value is inlined into the bundle at build time. If one is
// missing, Vite substitutes `undefined` and you only find out when a real
// user loads a white screen — the classic "it works locally but the deploy
// is broken" failure. We check up front instead, and name exactly which
// variable is missing.
const REQUIRED_BUILD_ENV = [
  'VITE_API_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({command, mode}) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '');
    const missing = REQUIRED_BUILD_ENV.filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(
        `\n\nMissing required build environment variables: ${missing.join(', ')}\n\n` +
          `Create a .env file in the frontend root (see .env.example), or set these\n` +
          `in your host's build settings, then rebuild. Vite bakes them in at build\n` +
          `time — redeploying alone will not pick them up.\n`,
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
