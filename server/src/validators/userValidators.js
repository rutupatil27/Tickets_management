import { z } from 'zod';
import {
  AVAILABILITY_VALUES,
  ROLE_VALUES,
  TICKET_CATEGORIES,
} from '../config/constants.js';
import { emailSchema, paginationQuery, passwordSchema, sanitizedString } from './common.js';

export const listUsersQuerySchema = z
  .object({
    ...paginationQuery,
    search: z.string().trim().max(120).optional(),
    role: z.union([z.enum(ROLE_VALUES), z.array(z.enum(ROLE_VALUES))]).optional(),
    availabilityStatus: z.enum(AVAILABILITY_VALUES).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    sort: z.enum(['newest', 'oldest', 'name']).optional().default('newest'),
  })
  .strip();

/**
 * Admin creating a support agent (spec §6).
 *
 * There is deliberately no `role` field: this endpoint can only ever produce an
 * agent. Customers sign themselves up via /api/auth/register, and `.strict()`
 * rejects any attempt to smuggle a role in.
 */
export const createAgentSchema = z
  .object({
    name: sanitizedString(2, 80, 'Full name'),
    email: emailSchema,
    password: passwordSchema,
    skills: z.array(z.enum(TICKET_CATEGORIES)).max(8).optional(),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: sanitizedString(2, 80, 'Full name').optional(),
    phone: z.string().trim().max(20).optional(),
    avatar: z.string().trim().max(500).optional(),
    skills: z.array(z.enum(TICKET_CATEGORIES)).max(8).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const updateRoleSchema = z
  .object({
    role: z.enum(ROLE_VALUES, {
      errorMap: () => ({ message: `Role must be one of: ${ROLE_VALUES.join(', ')}` }),
    }),
  })
  .strict();

export const updateActiveSchema = z
  .object({
    isActive: z.boolean({ required_error: 'isActive is required' }),
  })
  .strict();

export const updateAvailabilitySchema = z
  .object({
    availabilityStatus: z.enum(AVAILABILITY_VALUES, {
      errorMap: () => ({
        message: `Availability must be one of: ${AVAILABILITY_VALUES.join(', ')}`,
      }),
    }),
  })
  .strict();
