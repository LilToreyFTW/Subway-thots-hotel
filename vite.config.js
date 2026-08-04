import { defineConfig } from 'vite';
import { resolve } from 'path';

// Dev proxy + alias:
//  - /api/*    -> auth + community backend (port 7076) so the browser can call the
//                Discord auth endpoints without CORS issues during local dev.
//  - /discord-bot-sth/frontend -> the new auth UI modules, so the existing
//                index.html can import them without restructuring src/.
// Production should serve the API behind the same HTTPS origin.
export default defineConfig({
  resolve: {
    alias: {
      '/discord-bot-sth/frontend': resolve(__dirname, 'discord-bot-sth/frontend'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.STH_AUTH_BACKEND || 'http://127.0.0.1:7076',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
