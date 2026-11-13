import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel serves the app from the domain root. GitHub Pages serves this
// repository from /themediaplanner/, so each deployment needs its own base.
// A relative './' base breaks SPA routes such as /signup because assets are
// then requested from /signup/assets instead of /assets.
const base = process.env.GITHUB_PAGES === 'true' ? '/themediaplanner/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'charts-vendor': ['recharts'],
          'icons-vendor': ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 700
  }
});
