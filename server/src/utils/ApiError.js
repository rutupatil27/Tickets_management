import { ERROR_CODES } from '../config/constants.js';

/**
 * Operational error carrying an HTTP status and a stable machine-readable code.
 * Anything thrown that is not an ApiError is treated as a bug and reported as
 * a 500 without leaking internals to the client.
 */
export class ApiError extends Error {
  constructor(statusCode, message, errorCode = ERROR_CODES.INTERNAL_ERROR, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, code = ERROR_CODES.VALIDATION_ERROR, details) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Authentication required', code = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = ERROR_CODES.NOT_FOUND) {
    return new ApiError(404, message, code);
  }

  static conflict(message, code = ERROR_CODES.VALIDATION_ERROR) {
    return new ApiError(409, message, code);
  }

  static internal(message = 'Something went wrong', code = ERROR_CODES.INTERNAL_ERROR) {
    return new ApiError(500, message, code);
  }
}
