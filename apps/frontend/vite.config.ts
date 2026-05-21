import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

const isAdminUsersPath = (url: string): boolean => {
  const path = url.split('?')[0] ?? '/';
  return path === '/admin/users' || path.startsWith('/admin/users/');
};

const isDocumentNavigation = (method: string | undefined, accept: string | undefined, secFetchDest: string | undefined): boolean => {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }

  if (secFetchDest?.toLowerCase() === 'document') {
    return true;
  }

  return (accept ?? '').includes('text/html');
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'admin-users-refresh-spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const currentUrl = req.url ?? '/';
          const accept = typeof req.headers.accept === 'string' ? req.headers.accept : undefined;
          const secFetchDest = typeof req.headers['sec-fetch-dest'] === 'string'
            ? req.headers['sec-fetch-dest']
            : undefined;

          if (isAdminUsersPath(currentUrl) && isDocumentNavigation(req.method, accept, secFetchDest)) {
            req.url = '/admin';
          }

          next();
        });
      },
    },
  ],
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
      '/admin/users': {
        target: process.env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: true,
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/xstate/') || id.includes('/@xstate/')) {
            return 'xstate';
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/')
          ) {
            return 'vendor';
          }

          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Suppress warnings for now, will improve with lazy loading
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test/**',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
