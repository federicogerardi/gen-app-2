import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/generation': {
        target: process.env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
