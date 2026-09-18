import { Message } from '../models/Message.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import {
  ERROR_CODES,
  LOCKED_FOR_MESSAGES,
  MESSAGE_TYPE,
  NOTIFICATION_TYPE,
  ROLES,
  SOCKET_EVENTS,
} from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination.js';
import { emitToTicket, emitToUser } from '../sockets/realtime.js';
import { assertTicketAccess, idOf, ticketParticipants } from './ticketAccess.js';
import { createNotification } from './notificationService.js';
import { openTicketImage, removeTicketImage, saveTicketImage } from './attachmentStorage.js';

const SENDER_FIELDS = 'name email role avatar';

const populateSender = (query) => query.populate('senderId', SENDER_FIELDS);

/**
 * Persist a SYSTEM message (spec §24) and broadcast it to the ticket room.
 * System messages have no sender and are never rejected by the ticket lock.
 */
export async function createSystemMessage(ticket, content) {
  const message = await Message.create({
    ticketId: ticket._id,
    senderId: null,
    senderRole: 'system',
    type: MESSAGE_TYPE.SYSTEM,
    content,
  });

  const payload = message.toJSON();
  emitToTicket(ticket._id, SOCKET_EVENTS.TICKET_MESSAGE_NEW, {
    ticketId: ticket._id.toString(),
    message: payload,
  });

  return payload;
}

/**
 * Every customer/agent message - text or photo - goes through these two steps,
 * so access, the closed-ticket lock, persistence and broadcast can never drift
 * apart between the REST routes and the Socket.IO handler.
 */
async function loadWritableTicket({ ticketId, sender }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  assertTicketAccess(sender, ticket);

  if (LOCKED_FOR_MESSAGES.includes(ticket.status)) {
    throw ApiError.badRequest(
      'This ticket is closed. Reopen it to continue the conversation.',
      ERROR_CODES.TICKET_LOCKED,
    );
  }

  return ticket;
}

async function persistAndBroadcast({ ticket, sender, content = '', attachments = [], clientId }) {
  const message = await Message.create({
    ticketId: ticket._id,
    senderId: sender._id,
    senderRole: sender.role,
    type: MESSAGE_TYPE.TEXT,
    content,
    attachments,
    readBy: [sender._id],
  });

  const now = new Date();
  const ticketUpdate = { lastMessageAt: now };
  // First agent reply on the ticket - useful for future SLA reporting.
  if (sender.role === ROLES.AGENT && !ticket.firstResponseAt) {
    ticketUpdate.firstResponseAt = now;
  }
  await Ticket.updateOne({ _id: ticket._id }, { $set: ticketUpdate });

  const populated = await populateSender(Message.findById(message._id)).lean();
  const payload = { ...populated, clientId };

  // Persisted first, broadcast second: MongoDB stays the source of truth.
  emitToTicket(ticket._id, SOCKET_EVENTS.TICKET_MESSAGE_NEW, {
    ticketId: ticket._id.toString(),
    message: payload,
  });

  await notifyCounterparts({ ticket, sender, content, hasPhoto: attachments.length > 0 });

  return payload;
}

/** Text message - used by both the REST endpoint and the Socket.IO handler. */
export async function createTextMessage({ ticketId, sender, content, clientId }) {
  const ticket = await loadWritableTicket({ ticketId, sender });
  return persistAndBroadcast({ ticket, sender, content, clientId });
}

/**
 * Photo message with an optional caption. Uploaded over REST (sockets are a
 * poor fit for binary files) and then broadcast to the room like any other
 * message, so the other side still sees it instantly.
 */
export async function createPhotoMessage({ ticketId, sender, file, caption = '' }) {
  // Check access and the lock BEFORE writing anything to disk.
  const ticket = await loadWritableTicket({ ticketId, sender });

  const attachment = await saveTicketImage({ ticketId: ticket._id, file });

  try {
    return await persistAndBroadcast({ ticket, sender, content: caption, attachments: [attachment] });
  } catch (error) {
    // Do not leave an orphaned file behind if the message could not be saved.
    await removeTicketImage({ ticketId: ticket._id, storageKey: attachment.storageKey }).catch(() => {});
    throw error;
  }
}

/** Streams a ticket photo to a user who is allowed to see that ticket. */
export async function openTicketAttachment({ ticketId, storageKey, user }) {
  const ticket = await Ticket.findById(ticketId).select('createdBy assignedTo');
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  // Same rule as the conversation itself: a URL alone never grants access.
  assertTicketAccess(user, ticket);

  return openTicketImage({ ticketId: ticket._id, storageKey });
}

/** Notify whoever is on the other side of the conversation. */
async function notifyCounterparts({ ticket, sender, content, hasPhoto = false }) {
  const senderId = idOf(sender._id);
  const recipients = ticketParticipants(ticket).filter((id) => id !== senderId);

  const text = content || (hasPhoto ? 'sent a photo' : '');
  const truncated = text.length > 120 ? `${text.slice(0, 117)}...` : text;
  const preview = hasPhoto && content ? `[Photo] ${truncated}` : truncated;

  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: NOTIFICATION_TYPE.NEW_MESSAGE,
        title: `New message in ${ticket.ticketNumber}`,
        message: hasPhoto && !content ? `${sender.name} sent a photo` : `${sender.name}: ${preview}`,
        ticket,
      }),
    ),
  );
}

export async function listMessages({ ticketId, user, query = {} }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  assertTicketAccess(user, ticket);

  const { page, limit, skip } = resolvePagination(query);
  const order = query.order === 'desc' ? -1 : 1;

  const [messages, total] = await Promise.all([
    populateSender(Message.find({ ticketId: ticket._id }))
      .sort({ createdAt: order })
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments({ ticketId: ticket._id }),
  ]);

  return { messages, pagination: buildPaginationMeta({ page, limit, total }) };
}

/**
 * Marks every message in the ticket as read by this user and tells the room,
 * so the other side's "read" ticks update live (spec §28).
 */
export async function markTicketMessagesRead({ ticketId, user }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Ticket not found', ERROR_CODES.TICKET_NOT_FOUND);

  assertTicketAccess(user, ticket);

  const result = await Message.updateMany(
    { ticketId: ticket._id, readBy: { $ne: user._id } },
    { $addToSet: { readBy: user._id } },
  );

  if (result.modifiedCount > 0) {
    emitToTicket(ticket._id, SOCKET_EVENTS.TICKET_READ_UPDATE, {
      ticketId: ticket._id.toString(),
      userId: user._id.toString(),
      readAt: new Date().toISOString(),
    });
  }

  return { modified: result.modifiedCount ?? 0 };
}

/** Unread message counts for a set of tickets, used by the dashboards. */
export async function unreadCountsForTickets({ ticketIds, userId }) {
  if (!ticketIds.length) return {};

  const rows = await Message.aggregate([
    { $match: { ticketId: { $in: ticketIds }, readBy: { $ne: userId }, type: MESSAGE_TYPE.TEXT } },
    { $group: { _id: '$ticketId', count: { $sum: 1 } } },
  ]);

  return rows.reduce((acc, row) => {
    acc[row._id.toString()] = row.count;
    return acc;
  }, {});
}

export async function totalUnreadMessages({ user }) {
  const scope = user.role === ROLES.AGENT ? { assignedTo: user._id } : { createdBy: user._id };
  if (user.role === ROLES.ADMIN) return 0;

  const ticketIds = await Ticket.find(scope).distinct('_id');
  if (!ticketIds.length) return 0;

  return Message.countDocuments({
    ticketId: { $in: ticketIds },
    readBy: { $ne: user._id },
    senderId: { $ne: user._id },
    type: MESSAGE_TYPE.TEXT,
  });
}

/** Helper for socket handlers that need to push a direct error to one user. */
export function emitSocketError(userId, message, errorCode = ERROR_CODES.FORBIDDEN) {
  emitToUser(userId, SOCKET_EVENTS.SOCKET_ERROR, { message, errorCode });
}

/** Resolve a display name for system messages without an extra round-trip. */
export async function resolveUserName(userId) {
  if (!userId) return 'System';
  const user = await User.findById(userId).select('name').lean();
  return user?.name ?? 'System';
}
