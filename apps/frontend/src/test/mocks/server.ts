import { setupServer } from 'msw/node';

export const mswServer = setupServer();

export const resetMswHandlers = () => {
  mswServer.resetHandlers();
};

export const useMswHandler = (handler: Parameters<typeof mswServer.use>[0]) => {
  mswServer.use(handler);
};

export const useMswHandlers = (...handlers: Parameters<typeof mswServer.use>) => {
  mswServer.use(...handlers);
};
