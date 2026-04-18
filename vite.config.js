import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `vite dev`, proxy /api/* to the local Express server (npm run dev:api).
// In production on Vercel, /api/* is served by the serverless function in /api/index.js.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
