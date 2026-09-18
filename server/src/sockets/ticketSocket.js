import { Ticket, ticketRoom } from '../models/Ticket.js';
import { ERROR_CODES, SOCKET_EVENTS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { validatePayload } from '../middleware/validationMiddleware.js';
import {
  socketMessageSchema,
  socketTicketSchema,
} from '../validators/messageValidators.js';
import { canAccessTicket } from '../services/ticketAccess.js';
import { createTextMessage, markTicketMessagesRead } from '../services/messageService.js';

const ok = (data = {}) => ({ success: true, ...data });
const fail = (message, errorCode = ERROR_CODES.INTERNAL_ERROR) => ({
  success: false,
  message,
  errorCode,
});

/**
 * Wraps a handler so every failure becomes a structured ack + a `socket:error`
 * event instead of an unhandled rejection that silently kills the listener.
 */
const handle = (socket, name, fn) => async (payload, ack) => {
  try {
    const result = await fn(payload);
    if (typeof ack === 'function') ack(ok(result));
  } catch (error) {
    const isApiError = error instanceof ApiError;
    const response = fail(
      isApiError ? error.message : 'Something went wrong',
      isApiError ? error.errorCode : ERROR_CODES.INTERNAL_ERROR,
    );

    if (!isApiError) logger.error(`Socket ${name} failed:`, error.message);
    if (typeof ack === 'function') ack(response);
    socket.emit(SOCKET_EVENTS.SOCKET_ERROR, { event: name, ...response });
  }
};

/**
 * Loads the ticket and verifies this socket's user may see it (spec §50).
 * Never trust the ticket id sent by the client.
 */
async function loadAuthorizedTicket(socket, ticketId) {
  const ticket = await Ticket.findById(ticketId).select(
    'ticketNumber status createdBy assignedTo subject',
  );

  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  if (!canAccessTicket(socket.user, ticket)) {
    logger.warn(`Blocked room join: ${socket.user.email} -> ${ticket.ticketNumber}`);
    throw ApiError.forbidden('You do not have access to this ticket');
  }

  return ticket;
}

export function registerTicketHandlers(io, socket) {
  /* ---------------------------------------------------------------- join */
  socket.on(
    SOCKET_EVENTS.TICKET_JOIN,
    handle(socket, SOCKET_EVENTS.TICKET_JOIN, async (payload) => {
      const { ticketId } = validatePayload(socketTicketSchema, payload ?? {});
      const ticket = await loadAuthorizedTicket(socket, ticketId);

      const room = ticketRoom(ticket._id);
      await socket.join(room);

      socket.to(room).emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
        ticketId: ticket._id.toString(),
        user: { _id: socket.user._id, name: socket.user.name, role: socket.user.role },
        online: true,
      });

      return { ticketId: ticket._id.toString(), room };
    }),
  );

  /* --------------------------------------------------------------- leave */
  socket.on(
    SOCKET_EVENTS.TICKET_LEAVE,
    handle(socket, SOCKET_EVENTS.TICKET_LEAVE, async (payload) => {
      const { ticketId } = validatePayload(socketTicketSchema, payload ?? {});
      const room = ticketRoom(ticketId);

      await socket.leave(room);
      socket.to(room).emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
        ticketId,
        user: { _id: socket.user._id, name: socket.user.name, role: socket.user.role },
        online: false,
      });

      return { ticketId };
    }),
  );

  /* ------------------------------------------------------------- message */
  socket.on(
    SOCKET_EVENTS.TICKET_MESSAGE,
    handle(socket, SOCKET_EVENTS.TICKET_MESSAGE, async (payload) => {
      const { ticketId, content, clientId } = validatePayload(socketMessageSchema, payload ?? {});

      // createTextMessage re-checks access, persists to MongoDB and then
      // broadcasts. MongoDB stays the source of truth (spec §22).
      const message = await createTextMessage({
        ticketId,
        sender: socket.user,
        content,
        clientId,
      });

      return { message };
    }),
  );

  /* -------------------------------------------------------------- typing */
  // Typing is ephemeral - deliberately never written to MongoDB (spec §26).
  const typing = (event) =>
    handle(socket, event, async (payload) => {
      const { ticketId } = validatePayload(socketTicketSchema, payload ?? {});
      const ticket = await loadAuthorizedTicket(socket, ticketId);

      socket.to(ticketRoom(ticket._id)).emit(event, {
        ticketId: ticket._id.toString(),
        user: { _id: socket.user._id, name: socket.user.name, role: socket.user.role },
      });

      return { ticketId: ticket._id.toString() };
    });

  socket.on(SOCKET_EVENTS.TICKET_TYPING_START, typing(SOCKET_EVENTS.TICKET_TYPING_START));
  socket.on(SOCKET_EVENTS.TICKET_TYPING_STOP, typing(SOCKET_EVENTS.TICKET_TYPING_STOP));

  /* ---------------------------------------------------------------- read */
  socket.on(
    SOCKET_EVENTS.TICKET_READ,
    handle(socket, SOCKET_EVENTS.TICKET_READ, async (payload) => {
      const { ticketId } = validatePayload(socketTicketSchema, payload ?? {});
      const result = await markTicketMessagesRead({ ticketId, user: socket.user });
      return result;
    }),
  );
}
