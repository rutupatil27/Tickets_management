import { Ticket } from '../models/Ticket.js';
import {
  ERROR_CODES,
  NOTIFICATION_TYPE,
  ROLES,
  SOCKET_EVENTS,
  STATUS_TRANSITIONS,
  TICKET_STATUS,
} from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTicketNumber } from '../utils/generateTicketNumber.js';
import { buildPaginationMeta, escapeRegex, resolvePagination } from '../utils/pagination.js';
import { emitToRole, emitToTicket, emitToUser } from '../sockets/realtime.js';
import { assertTicketAccess, idOf, ticketParticipants, ticketScopeFilter } from './ticketAccess.js';
import {
  autoAssignTicket,
  getAssignmentHistory,
  populateTicket,
  processWaitingQueue,
  reassignTicket,
} from './assignmentService.js';
import { logger } from '../utils/logger.js';
import { createSystemMessage, unreadCountsForTickets } from './messageService.js';
import { createNotification } from './notificationService.js';

const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  priority: { priorityWeight: -1, createdAt: 1 },
  updated: { updatedAt: -1 },
};

const asArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a ticket and immediately run the assignment engine (spec §16).
 * The controller stays thin; all of this lives in the service layer (spec §37).
 */
export async function createTicket({ user, payload }) {
  const ticketNumber = await generateTicketNumber();

  const created = await Ticket.create({
    ticketNumber,
    subject: payload.subject,
    description: payload.description,
    category: payload.category,
    priority: payload.priority,
    status: TICKET_STATUS.OPEN,
    createdBy: user._id,
  });

  await createSystemMessage(created, `${user.name} created this ticket.`);

  const { assigned, ticket, agent } = await autoAssignTicket(created);

  emitToUser(user._id, SOCKET_EVENTS.TICKET_UPDATED, { ticket });
  emitToRole(ROLES.ADMIN, SOCKET_EVENTS.TICKET_UPDATED, { ticket });

  // If this ticket found an agent there may be spare capacity for older queued
  // tickets too. Fire-and-forget so the customer's request is not held up.
  if (assigned) {
    processWaitingQueue().catch((error) => logger.error('Queue drain failed:', error.message));
  }

  return {
    ticket,
    assigned,
    agent: agent ? { _id: agent._id, name: agent.name, email: agent.email } : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

export async function listTickets({ user, query = {} }) {
  const { page, limit, skip } = resolvePagination(query);

  const filter = { ...ticketScopeFilter(user) };

  const statuses = asArray(query.status);
  if (statuses.length) filter.status = { $in: statuses };

  const priorities = asArray(query.priority);
  if (priorities.length) filter.priority = { $in: priorities };

  const categories = asArray(query.category);
  if (categories.length) filter.category = { $in: categories };

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ ticketNumber: pattern }, { subject: pattern }];
  }

  // Admin-only filters. Ignored for other roles so a crafted query string can
  // never widen a customer's or agent's scope.
  if (user.role === ROLES.ADMIN) {
    if (query.agentId) filter.assignedTo = query.agentId;
    if (query.customerId) filter.createdBy = query.customerId;
    if (query.unassigned === 'true') filter.assignedTo = null;
  }

  const sort = SORT_MAP[query.sort] ?? SORT_MAP.updated;

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate('createdBy', 'name email avatar role')
      .populate('assignedTo', 'name email avatar role availabilityStatus')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  const unread = await unreadCountsForTickets({
    ticketIds: tickets.map((ticket) => ticket._id),
    userId: user._id,
  });

  return {
    tickets: tickets.map((ticket) => ({
      ...ticket,
      unreadCount: unread[ticket._id.toString()] ?? 0,
    })),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

export async function getTicketForUser({ user, ticketId }) {
  const ticket = await Ticket.findById(ticketId)
    .populate('createdBy', 'name email avatar role phone createdAt')
    .populate('assignedTo', 'name email avatar role availabilityStatus');

  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  assertTicketAccess(user, ticket);
  return ticket.toJSON();
}

export async function getTicketHistory({ user, ticketId }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  // Assignment history is operational data - only staff should read it.
  if (user.role === ROLES.CUSTOMER) {
    throw ApiError.forbidden('Assignment history is not available to customers');
  }
  assertTicketAccess(user, ticket);

  return getAssignmentHistory(ticket._id);
}

/* -------------------------------------------------------------------------- */
/* Status lifecycle                                                           */
/* -------------------------------------------------------------------------- */

export function isTransitionAllowed({ role, from, to }) {
  const allowed = STATUS_TRANSITIONS[role]?.[from] ?? [];
  return allowed.includes(to);
}

/** Statuses a given user may move this ticket to right now (drives the UI). */
export function allowedNextStatuses({ role, status }) {
  return STATUS_TRANSITIONS[role]?.[status] ?? [];
}

/**
 * The backend is authoritative over ticket status (spec §92.1 / Rule 10).
 * Every change: validate -> persist -> system message -> notify -> broadcast.
 */
export async function changeTicketStatus({ user, ticketId, status, note = '' }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  assertTicketAccess(user, ticket);

  const from = ticket.status;

  if (from === status) {
    throw ApiError.badRequest(`Ticket is already ${status}`, ERROR_CODES.INVALID_STATUS_TRANSITION);
  }

  if (!isTransitionAllowed({ role: user.role, from, to: status })) {
    const allowed = allowedNextStatuses({ role: user.role, status: from });
    throw ApiError.badRequest(
      allowed.length
        ? `A ${user.role} cannot move a ticket from ${from} to ${status}. Allowed: ${allowed.join(', ')}.`
        : `A ${user.role} cannot change the status of a ${from} ticket.`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  }

  const now = new Date();
  ticket.status = status;

  if (status === TICKET_STATUS.RESOLVED) {
    ticket.resolvedAt = now;
  } else if (status === TICKET_STATUS.CLOSED) {
    ticket.closedAt = now;
  } else if (status === TICKET_STATUS.REOPENED) {
    ticket.reopenedAt = now;
    ticket.reopenCount += 1;
    ticket.resolvedAt = null;
    ticket.closedAt = null;
  }

  await ticket.save();

  await createSystemMessage(
    ticket,
    `${user.name} changed status from ${from} to ${status}.${note ? ` Note: ${note}` : ''}`,
  );

  // A reopened ticket whose agent is gone goes straight back into the queue.
  let finalTicket = await populateTicket(ticket._id);
  if (status === TICKET_STATUS.REOPENED && !ticket.assignedTo) {
    const result = await autoAssignTicket(ticket);
    finalTicket = result.ticket ?? finalTicket;
  }

  await notifyStatusChange({ ticket, actor: user, from, to: status });

  const payload = { ticket: finalTicket, from, to: status, changedBy: publicActor(user) };
  emitToTicket(ticket._id, SOCKET_EVENTS.TICKET_STATUS_CHANGED, payload);
  ticketParticipants(ticket).forEach((userId) =>
    emitToUser(userId, SOCKET_EVENTS.TICKET_STATUS_CHANGED, payload),
  );
  emitToRole(ROLES.ADMIN, SOCKET_EVENTS.TICKET_UPDATED, { ticket: finalTicket });

  return finalTicket;
}

const publicActor = (user) => ({
  _id: user._id,
  name: user.name,
  role: user.role,
  avatar: user.avatar,
});

const STATUS_NOTIFICATION = {
  [TICKET_STATUS.RESOLVED]: {
    type: NOTIFICATION_TYPE.TICKET_RESOLVED,
    title: (t) => `${t.ticketNumber} resolved`,
    message: () => 'Your ticket has been marked as resolved. Please confirm or reopen it.',
  },
  [TICKET_STATUS.CLOSED]: {
    type: NOTIFICATION_TYPE.TICKET_CLOSED,
    title: (t) => `${t.ticketNumber} closed`,
    message: () => 'This ticket has been closed.',
  },
  [TICKET_STATUS.REOPENED]: {
    type: NOTIFICATION_TYPE.TICKET_REOPENED,
    title: (t) => `${t.ticketNumber} reopened`,
    message: () => 'This ticket has been reopened and needs attention.',
  },
};

async function notifyStatusChange({ ticket, actor, from, to }) {
  const recipients = ticketParticipants(ticket).filter((id) => id !== idOf(actor._id));
  const template = STATUS_NOTIFICATION[to];

  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: template?.type ?? NOTIFICATION_TYPE.STATUS_CHANGED,
        title: template ? template.title(ticket) : `${ticket.ticketNumber} updated`,
        message: template
          ? template.message(ticket)
          : `${actor.name} changed the status from ${from} to ${to}.`,
        ticket,
      }),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Priority + reassignment                                                    */
/* -------------------------------------------------------------------------- */

export async function changeTicketPriority({ user, ticketId, priority }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  assertTicketAccess(user, ticket);

  if (user.role === ROLES.CUSTOMER) {
    throw ApiError.forbidden('Only support staff can change ticket priority');
  }

  if (ticket.priority === priority) {
    throw ApiError.badRequest(`Ticket priority is already ${priority}`);
  }

  const from = ticket.priority;
  ticket.priority = priority;
  await ticket.save();

  await createSystemMessage(ticket, `${user.name} changed priority from ${from} to ${priority}.`);

  const populated = await populateTicket(ticket._id);
  emitToTicket(ticket._id, SOCKET_EVENTS.TICKET_UPDATED, { ticket: populated });
  emitToRole(ROLES.ADMIN, SOCKET_EVENTS.TICKET_UPDATED, { ticket: populated });

  return populated;
}

export async function reassignTicketAsAdmin({ admin, ticketId, agentId, note }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  return reassignTicket({ ticket, admin, agentId, note });
}
