import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractBearerToken, verifyToken } from '../utils/jwt.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Verifies the JWT and loads the *current* user document from MongoDB.
 * Reading the user on every request means a deactivated or demoted account
 * loses access immediately instead of when the token expires.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    throw ApiError.unauthorized('Authentication token is missing');
  }

  const payload = verifyToken(token);
  const user = await User.findById(payload.userId);

  if (!user) {
    throw ApiError.unauthorized('Account no longer exists', ERROR_CODES.INVALID_TOKEN);
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated', ERROR_CODES.ACCOUNT_INACTIVE);
  }

  req.user = user;
  req.token = token;
  next();
});

/** Attaches req.user when a token is present but never rejects the request. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.userId);
    if (user?.isActive) req.user = user;
  } catch {
    // ignore - route works anonymously
  }

  next();
});
