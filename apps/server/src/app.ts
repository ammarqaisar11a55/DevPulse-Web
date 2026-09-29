import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { API_PREFIX } from '@devpulse/shared';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { globalApiLimiter } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { createApiRouter } from './routes';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      autoLogging: { ignore: (req) => req.url?.startsWith(`${API_PREFIX}/health`) ?? false },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: [env.FRONTEND_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-DevPulse-Client'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '512kb' }));
  app.use(cookieParser());

  app.use(API_PREFIX, globalApiLimiter, createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
