import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { mswServer, resetMswHandlers } from './mocks/server';

// Setup MSW
beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  resetMswHandlers();
});

afterAll(() => {
  mswServer.close();
});
