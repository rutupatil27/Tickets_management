import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import {
  createPhotoMessage,
  createTextMessage,
  listMessages,
  markTicketMessagesRead,
  openTicketAttachment,
} from '../services/messageService.js';

/**
 * GET /api/tickets/:ticketId/messages
 * REST owns conversation *history*; Socket.IO owns live delivery (spec §48/§80).
 */
export const list = asyncHandler(async (req, res) => {
  const { messages, pagination } = await listMessages({
    ticketId: req.params.ticketId,
    user: req.user,
    query: req.query,
  });

  return sendSuccess(res, { message: 'Messages fetched', data: { messages, pagination } });
});

/**
 * POST /api/tickets/:ticketId/messages
 * Same service as the socket handler, so a message sent over REST is persisted
 * and broadcast to the room in exactly the same way.
 */
export const create = asyncHandler(async (req, res) => {
  const message = await createTextMessage({
    ticketId: req.params.ticketId,
    sender: req.user,
    content: req.body.content,
  });

  return sendCreated(res, { message: 'Message sent', data: { message } });
});

/**
 * POST /api/tickets/:ticketId/messages/photo   (multipart: image + optional content)
 * Saved, then broadcast to the ticket room exactly like a text message.
 */
export const createPhoto = asyncHandler(async (req, res) => {
  const message = await createPhotoMessage({
    ticketId: req.params.ticketId,
    sender: req.user,
    file: req.file,
    caption: req.body.content,
  });

  return sendCreated(res, { message: 'Photo sent', data: { message } });
});

/**
 * GET /api/tickets/:ticketId/attachments/:storageKey
 * Streams a photo only to the ticket's customer, its agent, or an admin.
 */
export const streamAttachment = asyncHandler(async (req, res) => {
  const { stream, size, mimeType } = await openTicketAttachment({
    ticketId: req.params.ticketId,
    storageKey: req.params.storageKey,
    user: req.user,
  });

  res.set({
    'Content-Type': mimeType,
    'Content-Length': size,
    'Content-Disposition': 'inline',
    // Private: shared caches must never keep a ticket's photos.
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });

  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  stream.pipe(res);
});

/** PATCH /api/tickets/:ticketId/messages/read */
export const markRead = asyncHandler(async (req, res) => {
  const result = await markTicketMessagesRead({
    ticketId: req.params.ticketId,
    user: req.user,
  });

  return sendSuccess(res, { message: 'Messages marked as read', data: result });
});
