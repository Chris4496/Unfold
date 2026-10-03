import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Unfold server (Express) runs on http://localhost:8787.
// All API calls go through the /api proxy so no key is ever bundled here.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
