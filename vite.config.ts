/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Preact, not React: ~4 KB instead of ~43 KB gzipped. The preset aliases
  // `react`/`react-dom` to `preact/compat`, so source keeps importing from
  // 'react' and type-checks against @types/react — nothing in src/ changes.
  plugins: [preact(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // The dev server has no Pages Functions, so `/api/config` (the site's
  // playlists and pictures) is read from the live site. Reads only. To run
  // the Function itself against a local database, use `npm run preview:cf`.
  server: {
    proxy: { '/api': { target: 'https://vibe-mode.pages.dev', changeOrigin: true } },
  },
  test: {
    // lucide-react has no `exports` map, so Node-side tools pick its CommonJS
    // build, whose `require('react')` fails — React itself isn't installed
    // since the move to Preact. Point the tests at its ESM build and run it
    // through Vite, so the `react` → `preact/compat` alias applies inside it.
    alias: [{ find: /^lucide-react$/, replacement: 'lucide-react/dist/esm/lucide-react.js' }],
    // motion imports 'react' too, so it goes through Vite (and the alias) the same way.
    server: { deps: { inline: [/lucide-react/, /motion/] } },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Keep the animation library out of the entry chunk so the shell paints fast.
        manualChunks: {
          motion: ['motion/react'],
          preact: ['preact', 'preact/compat', 'preact/hooks'],
        },
      },
    },
  },
});
