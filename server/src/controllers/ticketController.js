import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
} from '../config/constants.js';
import {
  allowedNextStatuses,
  changeTicketPriority,
  changeTicketStatus,
  createTicket,
  getTicketForUser,
  getTicketHistory,
  listTickets,
  reassignTicketAsAdmin,
} from '../services/ticketService.js';

/** POST /api/tickets */
export const create = asyncHandler(async (req, res) => {
  const { ticket, assigned, agent } = await createTicket({ user: req.user, payload: req.body });

  return sendCreated(res, {
    message: assigned
      ? `Ticket ${ticket.ticketNumber} created and assigned to ${agent.name}.`
      : `Ticket ${ticket.ticketNumber} created. Currently waiting for an available agent.`,
    data: { ticket, assigned, agent },
  });
});

/** GET /api/tickets */
export const list = asyncHandler(async (req, res) => {
  const { tickets, pagination } = await listTickets({ user: req.user, query: req.query });
  return sendSuccess(res, { message: 'Tickets fetched', data: { tickets, pagination } });
});

/** GET /api/tickets/:id */
export const getOne = asyncHandler(async (req, res) => {
  const ticket = await getTicketForUser({ user: req.user, ticketId: req.params.id });

  return sendSuccess(res, {
    message: 'Ticket fetched',
    data: {
      ticket,
      // Drives which action buttons the UI should render, without the client
      // needing to reimplement the transition table.
      allowedStatuses: allowedNextStatuses({ role: req.user.role, status: ticket.status }),
    },
  });
});

/** PATCH /api/tickets/:id/status */
export const updateStatus = asyncHandler(async (req, res) => {
  const ticket = await changeTicketStatus({
    user: req.user,
    ticketId: req.params.id,
    status: req.body.status,
    note: req.body.note,
  });

  return sendSuccess(res, {
    message: `Ticket status updated to ${req.body.status}`,
    data: {
      ticket,
      allowedStatuses: allowedNextStatuses({ role: req.user.role, status: ticket.status }),
    },
  });
});

/** PATCH /api/tickets/:id/priority */
export const updatePriority = asyncHandler(async (req, res) => {
  const ticket = await changeTicketPriority({
    user: req.user,
    ticketId: req.params.id,
    priority: req.body.priority,
  });

  return sendSuccess(res, { message: 'Ticket priority updated', data: { ticket } });
});

/** PATCH /api/tickets/:id/reassign  (admin only) */
export const reassign = asyncHandler(async (req, res) => {
  const ticket = await reassignTicketAsAdmin({
    admin: req.user,
    ticketId: req.params.id,
    agentId: req.body.agentId ?? null,
    note: req.body.note,
  });

  return sendSuccess(res, { message: 'Ticket reassigned successfully', data: { ticket } });
});

/** GET /api/tickets/:id/history  (agent/admin) */
export const history = asyncHandler(async (req, res) => {
  const entries = await getTicketHistory({ user: req.user, ticketId: req.params.id });
  return sendSuccess(res, { message: 'Assignment history fetched', data: { history: entries } });
});

/**
 * GET /api/tickets/meta
 * Lets the client build dropdowns from the server's vocabulary instead of
 * duplicating it (keeps the two in sync if categories move to a collection).
 */
export const meta = asyncHandler(async (_req, res) =>
  sendSuccess(res, {
    message: 'Ticket metadata',
    data: {
      categories: TICKET_CATEGORIES,
      priorities: TICKET_PRIORITY_VALUES,
      statuses: TICKET_STATUS_VALUES,
    },
  }),
);
