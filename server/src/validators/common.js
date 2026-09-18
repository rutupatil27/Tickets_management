import { z } from 'zod';
import mongoose from 'mongoose';
import { PAGINATION } from '../config/constants.js';

export const objectId = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), { message: 'Invalid id' });

export const idParam = z.object({ id: objectId });
export const ticketIdParam = z.object({ ticketId: objectId });

export const paginationQuery = {
  page: z.coerce.number().int().min(1).optional().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_LIMIT)
    .optional()
    .default(PAGINATION.DEFAULT_LIMIT),
};

/**
 * Strips control characters (newlines and tabs are kept) then trims.
 * This is the input-sanitisation step required by spec §51/§61.
 */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

export const sanitizedString = (min, max, label = 'Value') =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .transform((value) => value.replace(CONTROL_CHARS, '').trim())
    .refine((value) => value.length >= min, {
      message: `${label} must be at least ${min} characters`,
    })
    .refine((value) => value.length <= max, {
      message: `${label} must be at most ${max} characters`,
    });

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address')
  .max(160);

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');
