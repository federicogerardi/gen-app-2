import { setupServer } from 'msw/node';
import { streamHandlers } from './stream-handlers';

export const mswServer = setupServer();

export const resetMswHandlers = () => {
  mswServer.resetHandlers();
};

export const useMswHandler = (handler: Parameters<typeof mswServer.use>[0]) => {
  mswServer.use(handler);
};
