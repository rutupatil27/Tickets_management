import { z } from 'zod';
import { User } from '../models/User.js';
import { AVAILABILITY, ROLES } from '../config/constants.js';
import { env } from '../config/env.js';
import { emailSchema, passwordSchema, sanitizedString } from '../validators/common.js';

const adminConfigSchema = z.object({
  name: sanitizedString(2, 80, 'ADMIN_NAME'),
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Reads the first admin's details from server/.env and checks them against the
 * same rules the app uses, so the account can always sign in afterwards.
 */
export function readAdminConfig() {
  const missing = ['ADMIN_EMAIL', 'ADMIN_PASSWORD'].filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Set ${missing.join(' and ')} in server/.env before creating the admin account.`);
  }

  const result = adminConfigSchema.safeParse({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });

  if (!result.success) {
    const reasons = result.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`Admin details in server/.env are invalid: ${reasons}`);
  }

  return result.data;
}

/**
 * Creates the admin if it does not exist yet. Safe to run repeatedly: an
 * existing admin is left untouched (its password is never overwritten).
 */
export async function ensureAdminAccount() {
  const { name, email, password } = readAdminConfig();

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== ROLES.ADMIN) {
      throw new Error(`${email} is already registered as a ${existing.role}. Use a different ADMIN_EMAIL.`);
    }
    return { created: false, user: existing };
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role: ROLES.ADMIN,
    availabilityStatus: AVAILABILITY.OFFLINE,
    isActive: true,
  });

  return { created: true, user };
}
