import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// В dev-режиме запросы /api проксируются на бэкенд (порт 8080).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
