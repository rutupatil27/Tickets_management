import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Normalises every thrown error into the standard envelope (spec §59):
 * { success: false, message, errorCode }
 * Stack traces are only exposed outside production.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error instanceof mongoose.Error.ValidationError) {
      const details = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      error = ApiError.badRequest(details[0]?.message || 'Validation failed', ERROR_CODES.VALIDATION_ERROR, details);
    } else if (error instanceof mongoose.Error.CastError) {
      error = ApiError.badRequest(`Invalid value for "${error.path}"`, ERROR_CODES.VALIDATION_ERROR);
    } else if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      error = ApiError.conflict(
        `A record with that ${field} already exists`,
        field === 'email' ? ERROR_CODES.EMAIL_IN_USE : ERROR_CODES.VALIDATION_ERROR,
      );
    } else {
      logger.error('Unhandled error:', error?.stack || error);
      error = ApiError.internal(
        env.isProduction ? 'Something went wrong' : error?.message || 'Something went wrong',
      );
    }
  }

  const payload = {
    success: false,
    message: error.message,
    errorCode: error.errorCode,
  };

  if (error.details) payload.details = error.details;
  if (!env.isProduction && err?.stack) payload.stack = err.stack;

  return res.status(error.statusCode || 500).json(payload);
}
