import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/config -> src -> server
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PLACEHOLDER = '<PASTE_YOUR_MONGODB_URI_HERE>';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toInt(process.env.PORT, 5000),

  MONGO_URI: process.env.MONGO_URI || '',

  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_SALT_ROUNDS: toInt(process.env.BCRYPT_SALT_ROUNDS, 10),

  // Comma separated list of allowed browser origins.
  CLIENT_URLS: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // 0 disables the cap entirely.
  AGENT_MAX_ACTIVE_TICKETS: toInt(process.env.AGENT_MAX_ACTIVE_TICKETS, 0),

  // Optional extension point from spec §18. Off by default so the MVP uses the
  // plain "least loaded available agent" rule described in §14.
  ENABLE_SKILL_BASED_ROUTING: String(process.env.ENABLE_SKILL_BASED_ROUTING).toLowerCase() === 'true',

  // Where chat photos are stored. Empty = server/uploads.
  UPLOADS_DIR: process.env.UPLOADS_DIR || '',

  // Cloudinary credentials (optional - for cloud photo storage in production)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  // First admin account, created by `npm run create-admin`. There is no demo
  // data: customers sign up themselves and the admin adds agents.
  ADMIN_NAME: process.env.ADMIN_NAME || 'Administrator',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
};

env.isProduction = env.NODE_ENV === 'production';

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Shared by the REST CORS check and the Socket.IO handshake, so the two can
 * never disagree about who is allowed in.
 *
 * Outside production any localhost port is accepted: Vite silently moves to
 * 5174, 5175... when 5173 is taken, and a dev server that suddenly cannot talk
 * to the API is a miserable thing to debug. Production stays strict - only the
 * exact origins listed in CLIENT_URL.
 */
export function isAllowedOrigin(origin) {
  // No Origin header at all: curl, Postman, server-to-server, same-origin.
  if (!origin) return true;

  if (env.CLIENT_URLS.includes(origin)) return true;

  return !env.isProduction && LOCALHOST_ORIGIN.test(origin);
}

/**
 * Fail fast with a readable message instead of a cryptic driver error when the
 * developer has not filled in `.env` yet.
 */
export function assertEnv() {
  const problems = [];

  if (!env.MONGO_URI || env.MONGO_URI === PLACEHOLDER) {
    problems.push(
      'MONGO_URI is missing. Open server/.env and replace the placeholder with your MongoDB connection string.',
    );
  }

  if (!env.JWT_SECRET) {
    problems.push('JWT_SECRET is missing. Set it in server/.env.');
  }

  if (env.isProduction && env.JWT_SECRET.includes('change_me')) {
    problems.push('JWT_SECRET still uses the development default. Set a strong secret in production.');
  }

  if (problems.length) {
    throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
  }
}
