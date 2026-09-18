import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import routes from './routes/index.js';
import { env, isAllowedOrigin } from './config/env.js';
import { ApiError } from './utils/ApiError.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

export function createApp() {
  const app = express();

  // Behind Render/Railway/Vercel proxies so rate limiting sees the real IP.
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        // A rejected origin is an expected 403, not a crash: returning an
        // ApiError keeps it out of the "unhandled error" path and gives the
        // caller a readable reason instead of a bare 500.
        return callback(
          ApiError.forbidden(
            `Origin ${origin} is not allowed by CORS. Add it to CLIENT_URL in server/.env.`,
          ),
        );
      },
      credentials: true,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProduction) app.use(morgan('dev'));

  app.get('/', (_req, res) =>
    res.json({ success: true, message: 'SupportDesk API', data: { docs: '/api/health' } }),
  );

  app.use('/api', apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
