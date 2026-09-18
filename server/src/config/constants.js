/**
 * Single source of truth for the SupportDesk domain vocabulary.
 * The client mirrors these values in `client/src/utils/constants.js`.
 */

export const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  AGENT: 'agent',
  ADMIN: 'admin',
});

export const ROLE_VALUES = Object.values(ROLES);

export const AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
});

export const AVAILABILITY_VALUES = Object.values(AVAILABILITY);

export const TICKET_STATUS = Object.freeze({
  OPEN: 'OPEN',
  WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_CUSTOMER: 'WAITING_FOR_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
});

export const TICKET_STATUS_VALUES = Object.values(TICKET_STATUS);

/** Statuses that count towards an agent's workload (spec §54). */
export const ACTIVE_TICKET_STATUSES = Object.freeze([
  TICKET_STATUS.ASSIGNED,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.WAITING_FOR_CUSTOMER,
  TICKET_STATUS.REOPENED,
]);

/** Statuses where the ticket still needs an agent. */
export const UNASSIGNED_STATUSES = Object.freeze([
  TICKET_STATUS.OPEN,
  TICKET_STATUS.WAITING_FOR_AGENT,
]);

export const CLOSED_STATUSES = Object.freeze([TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED]);

export const TICKET_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

export const TICKET_PRIORITY_VALUES = Object.values(TICKET_PRIORITY);

/** Higher number == assigned first out of the waiting queue (spec §17). */
export const PRIORITY_WEIGHT = Object.freeze({
  [TICKET_PRIORITY.URGENT]: 4,
  [TICKET_PRIORITY.HIGH]: 3,
  [TICKET_PRIORITY.MEDIUM]: 2,
  [TICKET_PRIORITY.LOW]: 1,
});

/**
 * Fixed category list for the MVP. Kept as a plain array so it can be moved to
 * a `categories` collection later without touching call sites (spec §10).
 */
export const TICKET_CATEGORIES = Object.freeze([
  'Account',
  'Login',
  'Payment',
  'Order',
  'Technical Issue',
  'Refund',
  'Delivery',
  'Other',
]);

export const MESSAGE_TYPE = Object.freeze({
  TEXT: 'TEXT',
  SYSTEM: 'SYSTEM',
});

export const MESSAGE_TYPE_VALUES = Object.values(MESSAGE_TYPE);

export const NOTIFICATION_TYPE = Object.freeze({
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  TICKET_REASSIGNED: 'TICKET_REASSIGNED',
  TICKET_WAITING: 'TICKET_WAITING',
  NEW_MESSAGE: 'NEW_MESSAGE',
  STATUS_CHANGED: 'STATUS_CHANGED',
  TICKET_RESOLVED: 'TICKET_RESOLVED',
  TICKET_CLOSED: 'TICKET_CLOSED',
  TICKET_REOPENED: 'TICKET_REOPENED',
});

export const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPE);

export const ASSIGNMENT_REASON = Object.freeze({
  LEAST_LOADED_AGENT: 'LEAST_LOADED_AGENT',
  SKILL_MATCH_LEAST_LOADED: 'SKILL_MATCH_LEAST_LOADED',
  QUEUE_DRAIN: 'QUEUE_DRAIN',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
  NO_AGENT_AVAILABLE: 'NO_AGENT_AVAILABLE',
});

export const ASSIGNED_BY_TYPE = Object.freeze({
  SYSTEM: 'SYSTEM',
  ADMIN: 'ADMIN',
});

/**
 * Allowed status transitions per role (spec §52).
 * The backend is authoritative: anything not listed here is rejected.
 */
export const STATUS_TRANSITIONS = Object.freeze({
  [ROLES.AGENT]: Object.freeze({
    [TICKET_STATUS.ASSIGNED]: [TICKET_STATUS.IN_PROGRESS],
    [TICKET_STATUS.IN_PROGRESS]: [TICKET_STATUS.WAITING_FOR_CUSTOMER, TICKET_STATUS.RESOLVED],
    [TICKET_STATUS.WAITING_FOR_CUSTOMER]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.RESOLVED],
    [TICKET_STATUS.REOPENED]: [TICKET_STATUS.IN_PROGRESS],
  }),
  [ROLES.CUSTOMER]: Object.freeze({
    [TICKET_STATUS.RESOLVED]: [TICKET_STATUS.CLOSED, TICKET_STATUS.REOPENED],
    [TICKET_STATUS.CLOSED]: [TICKET_STATUS.REOPENED],
  }),
  [ROLES.ADMIN]: Object.freeze({
    [TICKET_STATUS.OPEN]: [TICKET_STATUS.WAITING_FOR_AGENT, TICKET_STATUS.ASSIGNED],
    [TICKET_STATUS.WAITING_FOR_AGENT]: [TICKET_STATUS.ASSIGNED, TICKET_STATUS.CLOSED],
    [TICKET_STATUS.ASSIGNED]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CLOSED],
    [TICKET_STATUS.IN_PROGRESS]: [
      TICKET_STATUS.WAITING_FOR_CUSTOMER,
      TICKET_STATUS.RESOLVED,
      TICKET_STATUS.CLOSED,
    ],
    [TICKET_STATUS.WAITING_FOR_CUSTOMER]: [
      TICKET_STATUS.IN_PROGRESS,
      TICKET_STATUS.RESOLVED,
      TICKET_STATUS.CLOSED,
    ],
    [TICKET_STATUS.RESOLVED]: [TICKET_STATUS.CLOSED, TICKET_STATUS.REOPENED],
    [TICKET_STATUS.CLOSED]: [TICKET_STATUS.REOPENED],
    [TICKET_STATUS.REOPENED]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CLOSED],
  }),
});

/**
 * Statuses where a normal TEXT message is rejected (spec Rule 11).
 * The conversation stays readable, but it must be reopened to continue.
 */
export const LOCKED_FOR_MESSAGES = Object.freeze([TICKET_STATUS.CLOSED]);

export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  TICKET_LOCKED: 'TICKET_LOCKED',
  AGENT_UNAVAILABLE: 'AGENT_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

export const SOCKET_EVENTS = Object.freeze({
  // client -> server
  TICKET_JOIN: 'ticket:join',
  TICKET_LEAVE: 'ticket:leave',
  TICKET_MESSAGE: 'ticket:message',
  TICKET_TYPING_START: 'ticket:typing:start',
  TICKET_TYPING_STOP: 'ticket:typing:stop',
  TICKET_READ: 'ticket:read',

  // server -> client
  TICKET_MESSAGE_NEW: 'ticket:message:new',
  TICKET_READ_UPDATE: 'ticket:read:update',
  TICKET_STATUS_CHANGED: 'ticket:status:changed',
  TICKET_ASSIGNED: 'ticket:assigned',
  TICKET_UPDATED: 'ticket:updated',
  NOTIFICATION_NEW: 'notification:new',
  PRESENCE_UPDATE: 'presence:update',
  SOCKET_ERROR: 'socket:error',
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});
