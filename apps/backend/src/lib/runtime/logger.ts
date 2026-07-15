import pino from 'pino';
import { serializers } from './log-serializers';

export const logger = pino({
  name: 'gen-app-2-backend',
  level: process.env.LOG_LEVEL || 'info',
  serializers,
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});
