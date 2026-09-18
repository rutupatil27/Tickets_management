import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

const formatIssues = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

/**
 * validate({ body, query, params }) - each key holds a Zod schema.
 * Parsed (and coerced) values replace the raw request values, so controllers
 * always receive clean, typed input. Backend validation is mandatory (spec §60).
 */
export const validate = (schemas) => (req, _res, next) => {
  try {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body);
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      return next(
        ApiError.badRequest(
          formatIssues(error)[0]?.message || 'Validation failed',
          ERROR_CODES.VALIDATION_ERROR,
          formatIssues(error),
        ),
      );
    }
    return next(error);
  }
};

/** Validates a plain object outside of Express (used by socket handlers). */
export function validatePayload(schema, payload) {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw ApiError.badRequest(
        formatIssues(error)[0]?.message || 'Validation failed',
        ERROR_CODES.VALIDATION_ERROR,
        formatIssues(error),
      );
    }
    throw error;
  }
}
