import pino from 'pino';

export const logger = pino({
  name: 'gen-app-2-backend',
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});
