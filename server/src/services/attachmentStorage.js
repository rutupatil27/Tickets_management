import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import {
  ALLOWED_IMAGE_TYPES,
  STORAGE_KEY_PATTERN,
  UPLOADS_DIR,
  detectImageType,
} from '../config/uploads.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Local-disk storage for chat photos, one folder per ticket:
 *   server/uploads/<ticketId>/<random>.jpg
 *
 * Kept behind this small interface so it can be swapped for S3 / Cloudinary
 * later without touching the message service or the routes.
 */

const ticketDir = (ticketId) => path.join(UPLOADS_DIR, ticketId.toString());

/** Browser-safe display name: no paths, no control characters, bounded length. */
function cleanDisplayName(originalName, ext) {
  const base = path
    .basename(String(originalName || 'photo'))
    .replace(/[^\w.\- ()]+/g, '_')
    .trim()
    .slice(0, 80);
  return base || `photo.${ext}`;
}

export async function saveTicketImage({ ticketId, file }) {
  if (!file?.buffer?.length) {
    throw ApiError.badRequest('Please choose a photo to upload', ERROR_CODES.VALIDATION_ERROR);
  }

  const detected = detectImageType(file.buffer);
  if (!detected || !ALLOWED_IMAGE_TYPES[detected.mime]) {
    throw ApiError.badRequest(
      'That file is not a supported image. Use JPG, PNG, GIF or WebP.',
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const storageKey = `${crypto.randomBytes(16).toString('hex')}.${detected.ext}`;
  const directory = ticketDir(ticketId);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, storageKey), file.buffer, { flag: 'wx' });

  return {
    storageKey,
    url: `/api/tickets/${ticketId}/attachments/${storageKey}`,
    filename: cleanDisplayName(file.originalname, detected.ext),
    // The detected type, not whatever the browser claimed.
    mimeType: detected.mime,
    size: file.buffer.length,
  };
}

/**
 * Resolves a stored file for streaming. The key must match the generated
 * pattern, which rules out path traversal before the filesystem is touched.
 */
export async function openTicketImage({ ticketId, storageKey }) {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw ApiError.notFound('Attachment not found');
  }

  const filePath = path.join(ticketDir(ticketId), storageKey);

  try {
    const stats = await fs.stat(filePath);
    const ext = storageKey.split('.').pop();
    const mimeType = Object.entries(ALLOWED_IMAGE_TYPES).find(([, e]) => e === ext)?.[0];

    return { stream: createReadStream(filePath), size: stats.size, mimeType };
  } catch {
    throw ApiError.notFound('Attachment not found');
  }
}

/** Best-effort cleanup when a message write fails after the file was saved. */
export async function removeTicketImage({ ticketId, storageKey }) {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) return;
  await fs.rm(path.join(ticketDir(ticketId), storageKey), { force: true });
}

/** Used by `db:reset` so wiping the database also wipes orphaned photos. */
export async function removeAllUploads() {
  await fs.rm(UPLOADS_DIR, { recursive: true, force: true });
}
