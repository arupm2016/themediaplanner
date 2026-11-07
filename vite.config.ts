import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? './' : '/',
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
