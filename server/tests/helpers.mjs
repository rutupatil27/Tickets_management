import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the real .env first, then redirect MONGO_URI at a dedicated test
// database so integration tests never touch development data.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TEST_DB = 'supportdesk_test';

function withTestDatabase(uri) {
  if (!uri) throw new Error('MONGO_URI is not set - fill in server/.env before running tests');

  const [base, query] = uri.split('?');
  const withoutTrailing = base.replace(/\/[^/]*$/, '');
  const root = base.endsWith('/') ? base.slice(0, -1) : withoutTrailing;

  return `${root}/${TEST_DB}${query ? `?${query}` : ''}`;
}

process.env.MONGO_URI = withTestDatabase(process.env.MONGO_URI);
process.env.NODE_ENV = 'test';
process.env.PORT = '5099';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_value_123456';
// Real bcrypt, minimum work factor: the suite creates ~15 accounts and does
// dozens of logins, and 10 rounds adds several minutes of pure CPU time.
process.env.BCRYPT_SALT_ROUNDS = '4';
// Uploaded test photos go to a throwaway folder, never server/uploads.
export const TEST_UPLOADS_DIR = path.join(os.tmpdir(), `supportdesk-test-uploads-${process.pid}`);
process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;

export const BASE_URL = 'http://127.0.0.1:5099';

let server;
let mongooseRef;

export async function startTestServer() {
  const [{ createApp }, { connectDB }, { createSocketServer }, mongoose] = await Promise.all([
    import('../src/app.js'),
    import('../src/config/db.js'),
    import('../src/sockets/socketServer.js'),
    import('mongoose'),
  ]);

  mongooseRef = mongoose.default ?? mongoose;

  await connectDB();
  await mongooseRef.connection.dropDatabase();

  const app = createApp();
  server = http.createServer(app);
  createSocketServer(server);

  await new Promise((resolve) => server.listen(5099, '127.0.0.1', resolve));
  return server;
}

export async function stopTestServer() {
  if (mongooseRef?.connection?.readyState === 1) {
    await mongooseRef.connection.dropDatabase();
    await mongooseRef.connection.close();
  }
  if (server) {
    // Keep-alive and lingering socket.io connections would otherwise hold
    // `close()` open until their idle timeout expires.
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await fs.rm(TEST_UPLOADS_DIR, { recursive: true, force: true });
}

/** Multipart photo upload, returning { status, body }. */
export async function uploadPhoto({ ticketId, token, bytes, filename = 'photo.png', type = 'image/png', content }) {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type }), filename);
  if (content !== undefined) form.append('content', content);

  const response = await fetch(`${BASE_URL}/api/tickets/${ticketId}/messages/photo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  return { status: response.status, body: await response.json().catch(() => null) };
}

/** A real, minimal 1x1 PNG. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Thin fetch wrapper returning { status, body }. */
export async function api(pathname, { method = 'GET', body, token, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (raw) return { status: response.status, body: parsed, response };
  return { status: response.status, body: parsed };
}

export async function registerCustomer({ name, email, password = 'Password@123' }) {
  const { body } = await api('/api/auth/register', {
    method: 'POST',
    body: { name, email, password, confirmPassword: password },
  });
  return { token: body?.data?.token, user: body?.data?.user };
}

export async function login(email, password = 'Password@123') {
  const { status, body } = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return { status, token: body?.data?.token, user: body?.data?.user, body };
}

/** Creates a user document directly - used to bootstrap the first admin. */
export async function createUserDirect({ name, email, role, password = 'Password@123', ...rest }) {
  const { User } = await import('../src/models/User.js');
  const passwordHash = await User.hashPassword(password);
  return User.create({ name, email, passwordHash, role, ...rest });
}

export async function setAvailability({ token, userId, availabilityStatus }) {
  return api(`/api/users/${userId}/availability`, {
    method: 'PATCH',
    token,
    body: { availabilityStatus },
  });
}

/**
 * Emits an event and resolves with the server's ack.
 * Socket.IO acks have no built-in timeout, so a handler that never replies
 * would otherwise hang the whole test file instead of failing one test.
 */
export function emitWithAck(socket, event, payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No ack received for "${event}" within ${timeout}ms`)),
      timeout,
    );
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

export function waitFor(emitter, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeout);
    emitter.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
