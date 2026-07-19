import { vi } from 'vitest';

export const createFeedbackApiSpy = () => ({
  publishSuccess: vi.fn(),
  publishError: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
});
