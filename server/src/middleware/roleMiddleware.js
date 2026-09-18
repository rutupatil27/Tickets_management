import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../config/constants.js';

/**
 * authorize('admin')            -> admin only
 * authorize('agent', 'admin')   -> either role
 * Must run after `authenticate`.
 */
export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      ApiError.forbidden(
        `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      ),
    );
  }

  return next();
};

export const adminOnly = authorize(ROLES.ADMIN);
export const agentOnly = authorize(ROLES.AGENT);
export const customerOnly = authorize(ROLES.CUSTOMER);
export const staffOnly = authorize(ROLES.AGENT, ROLES.ADMIN);
