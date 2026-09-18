import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * JWT payload is intentionally minimal (spec §7): { userId, role }.
 * Everything else is re-read from MongoDB on each request so a revoked or
 * demoted user cannot keep acting on a stale token payload.
 */
export function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token', ERROR_CODES.INVALID_TOKEN);
  }
}

export function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}
