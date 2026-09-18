import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITY,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
} from '../config/constants.js';
import { objectId, paginationQuery, sanitizedString } from './common.js';

export const createTicketSchema = z
  .object({
    subject: sanitizedString(5, 140, 'Subject'),
    description: sanitizedString(10, 5000, 'Description'),
    category: z.enum(TICKET_CATEGORIES, {
      errorMap: () => ({ message: `Category must be one of: ${TICKET_CATEGORIES.join(', ')}` }),
    }),
    priority: z
      .enum(TICKET_PRIORITY_VALUES, {
        errorMap: () => ({ message: `Priority must be one of: ${TICKET_PRIORITY_VALUES.join(', ')}` }),
      })
      .default(TICKET_PRIORITY.MEDIUM),
  })
  .strict();

export const listTicketsQuerySchema = z
  .object({
    ...paginationQuery,
    search: z.string().trim().max(140).optional(),
    status: z
      .union([z.enum(TICKET_STATUS_VALUES), z.array(z.enum(TICKET_STATUS_VALUES))])
      .optional(),
    priority: z
      .union([z.enum(TICKET_PRIORITY_VALUES), z.array(z.enum(TICKET_PRIORITY_VALUES))])
      .optional(),
    category: z.union([z.enum(TICKET_CATEGORIES), z.array(z.enum(TICKET_CATEGORIES))]).optional(),
    // admin-only filters, silently ignored for other roles
    agentId: objectId.optional(),
    customerId: objectId.optional(),
    unassigned: z.enum(['true', 'false']).optional(),
    sort: z.enum(['newest', 'oldest', 'priority', 'updated']).optional().default('updated'),
  })
  .strip();

export const updateStatusSchema = z
  .object({
    status: z.enum(TICKET_STATUS_VALUES, {
      errorMap: () => ({ message: `Status must be one of: ${TICKET_STATUS_VALUES.join(', ')}` }),
    }),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const updatePrioritySchema = z
  .object({
    priority: z.enum(TICKET_PRIORITY_VALUES, {
      errorMap: () => ({ message: `Priority must be one of: ${TICKET_PRIORITY_VALUES.join(', ')}` }),
    }),
  })
  .strict();

export const reassignSchema = z
  .object({
    // null/omitted -> let the assignment engine pick the least-loaded agent
    agentId: objectId.nullable().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .strict();
