import { pino } from 'pino';
import { env, isProduction, isTest } from '../config/env';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.key',
    ],
    censor: '[redacted]',
  },
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
