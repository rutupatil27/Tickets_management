import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '../config/constants.js';
import { env } from '../config/env.js';

const limitResponse = (message) => (_req, res) =>
  res.status(429).json({ success: false, message, errorCode: ERROR_CODES.RATE_LIMITED });

/** Tight limit on credential endpoints to slow down brute-force attempts. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProduction ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitResponse('Too many authentication attempts. Please try again in 15 minutes.'),
});

/** Broad safety net for the rest of the API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.isProduction ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitResponse('Too many requests. Please slow down.'),
});
