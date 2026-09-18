import { z } from 'zod';
import { emailSchema, passwordSchema, sanitizedString } from './common.js';

export const registerSchema = z
  .object({
    name: sanitizedString(2, 80, 'Full name'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
  })
  // `role` is deliberately NOT accepted here - self-registration is always a
  // customer (spec §6). Agents are added by an admin; the first admin comes
  // from `npm run create-admin`.
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: sanitizedString(2, 80, 'Full name').optional(),
    phone: z.string().trim().max(20).optional(),
    avatar: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string({ required_error: 'Please confirm your new password' }),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
