import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redirige las llamadas del API al backend Express.
      '/api': { target: process.env.DEV_API_TARGET || 'http://localhost:4000', changeOrigin: true },
    },
  },
});
