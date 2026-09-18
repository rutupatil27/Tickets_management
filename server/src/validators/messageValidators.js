import { z } from 'zod';
import { objectId, paginationQuery, sanitizedString } from './common.js';

export const createMessageSchema = z
  .object({
    content: sanitizedString(1, 4000, 'Message'),
  })
  .strict();

/** Multipart text fields that accompany a photo upload. */
export const photoMessageSchema = z
  .object({
    content: sanitizedString(0, 4000, 'Caption').optional().default(''),
  })
  .strict();

export const attachmentParams = z.object({
  ticketId: objectId,
  storageKey: z.string().max(64),
});

export const listMessagesQuerySchema = z
  .object({
    ...paginationQuery,
    // ascending is the natural reading order for a conversation
    order: z.enum(['asc', 'desc']).optional().default('asc'),
  })
  .strip();

/** Socket payload for `ticket:message`. */
export const socketMessageSchema = z.object({
  ticketId: objectId,
  content: sanitizedString(1, 4000, 'Message'),
  clientId: z.string().trim().max(64).optional(),
});

export const socketTicketSchema = z.object({
  ticketId: objectId,
});
