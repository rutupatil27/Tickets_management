import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

const idOf = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

/**
 * Business Rules 1-3 (spec §75) in one place:
 *   - customers see only tickets they created
 *   - agents see only tickets assigned to them
 *   - admins see everything
 *
 * A ticket id alone must never grant access (spec §92.7), so every REST route
 * and every socket handler funnels through this function.
 */
export function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;

  if (user.role === ROLES.ADMIN) return true;

  if (user.role === ROLES.AGENT) {
    return idOf(ticket.assignedTo) === idOf(user._id);
  }

  return idOf(ticket.createdBy) === idOf(user._id);
}

export function assertTicketAccess(user, ticket) {
  if (!canAccessTicket(user, ticket)) {
    // Deliberately a 403 with a generic message: we do not confirm or deny
    // whether some other user's ticket exists.
    throw ApiError.forbidden('You do not have access to this ticket', ERROR_CODES.FORBIDDEN);
  }
  return true;
}

/** The mongo filter that scopes a ticket query to what this user may see. */
export function ticketScopeFilter(user) {
  if (user.role === ROLES.ADMIN) return {};
  if (user.role === ROLES.AGENT) return { assignedTo: user._id };
  return { createdBy: user._id };
}

/** Everyone who should be notified about activity on a ticket. */
export function ticketParticipants(ticket) {
  return [idOf(ticket.createdBy), idOf(ticket.assignedTo)].filter(Boolean);
}

export { idOf };
