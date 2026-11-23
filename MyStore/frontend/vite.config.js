import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forwards /api calls to your backend, so no CORS problems in development.
    // Change 5001 if your backend runs on another port.
    proxy: { '/api': 'http://localhost:5001', '/uploads': 'http://localhost:5001' },
  },
});
