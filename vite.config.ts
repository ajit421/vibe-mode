import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Says out loud, in the build log, when a build is going out with no playlists
 * or no backgrounds configured.
 *
 * `.env` is gitignored, so a host that builds from the repo — Netlify — starts
 * with none of these set. Vite inlines `import.meta.env` at build time, so the
 * shipped bundle then contains `undefined` for every one of them, and the site
 * quietly serves colour gradients and setup hints instead of artwork and music.
 * Every individual failure is handled gracefully by design, which is exactly
 * what makes the whole-config-missing case so hard to spot: nothing is broken,
 * there is simply nothing there, and the deploy looks like a success.
 *
 * This does not fail the build. A deploy with no playlists is a legitimate
 * thing to want — a preview, or a first deploy before the variables are in.
 * It just refuses to be silent about it.
 */
function warnOnMissingConfig(): Plugin {
  return {
    name: 'vibe-mode:warn-on-missing-config',
    apply: 'build',
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), 'VITE_');
      const set = (prefix: string) =>
        Object.entries(env).filter(([key, value]) => key.startsWith(prefix) && value.trim())
          .length;

      const playlists = set('VITE_PLAYLIST_');
      const images = set('VITE_IMAGE_');

      if (playlists && images) return;

      const missing = [
        !playlists && 'VITE_PLAYLIST_* (no playlist will play)',
        !images && 'VITE_IMAGE_* (every mode falls back to its gradient)',
      ].filter(Boolean);

      config.logger.warn(
        `\n\x1b[33m▲ Vibe Mode: building with no ${missing.join(' and no ')}.\x1b[0m\n` +
          `  .env is gitignored, so it does not reach the build host. Set these\n` +
          `  under Netlify → Site configuration → Environment variables, then\n` +
          `  redeploy. Nothing will error at runtime — it will just be empty.\n`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), warnOnMissingConfig()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Keep the animation library out of the entry chunk so the shell paints fast.
        manualChunks: {
          motion: ['motion/react'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
