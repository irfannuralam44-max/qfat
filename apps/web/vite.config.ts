import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [],
    proxy: {
      '^/api/v1(?:/|$)': {
        target: 'http://127.0.0.1:3001',
        // Preserve the browser-facing Host so the backend can compare it
        // with Origin. Never substitute forwarded headers for this value.
        changeOrigin: false,
      },
    },
  },
});
