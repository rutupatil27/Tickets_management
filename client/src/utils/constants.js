/**
 * Mirrors `server/src/config/constants.js`.
 * The backend remains authoritative - these values only drive labels, colours
 * and optimistic UI. Never re-implement a business rule here.
 */

export const ROLES = {
  CUSTOMER: 'customer',
  AGENT: 'agent',
  ADMIN: 'admin',
};

export const ROLE_LABELS = {
  customer: 'Customer',
  agent: 'Support Agent',
  admin: 'Administrator',
};

export const AVAILABILITY = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
};

export const AVAILABILITY_LABELS = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
};

export const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available', hint: 'Receive new tickets automatically' },
  { value: 'busy', label: 'Busy', hint: 'Keep current tickets, stop new assignments' },
  { value: 'offline', label: 'Offline', hint: 'Not working right now' },
];

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_CUSTOMER: 'WAITING_FOR_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
};

export const TICKET_STATUS_VALUES = Object.values(TICKET_STATUS);

export const STATUS_LABELS = {
  OPEN: 'Open',
  WAITING_FOR_AGENT: 'Waiting for agent',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CUSTOMER: 'Waiting for customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

export const ACTIVE_TICKET_STATUSES = [
  TICKET_STATUS.ASSIGNED,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.WAITING_FOR_CUSTOMER,
  TICKET_STATUS.REOPENED,
];

export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

export const TICKET_PRIORITY_VALUES = Object.values(TICKET_PRIORITY);

export const PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const MESSAGE_TYPE = {
  TEXT: 'TEXT',
  SYSTEM: 'SYSTEM',
};

export const MESSAGE_TYPE_SYSTEM = MESSAGE_TYPE.SYSTEM;

export const TICKET_CATEGORIES = [
  'Account',
  'Login',
  'Payment',
  'Order',
  'Technical Issue',
  'Refund',
  'Delivery',
  'Other',
];

export const SOCKET_EVENTS = {
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
  CONNECTION_READY: 'connection:ready',
};

/** Landing route per role, used after login and by the role guards. */
export const ROLE_HOME = {
  customer: '/customer/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
};

/** Route prefix per role - keeps ticket links role-aware in shared components. */
export const ROLE_BASE_PATH = {
  customer: '/customer',
  agent: '/agent',
  admin: '/admin',
};
