import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import {
  ALLOWED_IMAGE_TYPES,
  STORAGE_KEY_PATTERN,
  UPLOADS_DIR,
  detectImageType,
} from '../config/uploads.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Storage service for chat photos:
 *   - Local disk in development (server/uploads/<ticketId>/<random>.jpg)
 *   - Cloudinary in production if CLOUDINARY_* environment variables are set.
 */

const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

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

function uploadToCloudinary(buffer, ticketId, storageKey) {
  return new Promise((resolve, reject) => {
    const publicId = path.parse(storageKey).name;
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `supportdesk/${ticketId}`,
        public_id: publicId,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
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

  if (isCloudinaryConfigured) {
    await uploadToCloudinary(file.buffer, ticketId, storageKey);
  } else {
    const directory = ticketDir(ticketId);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, storageKey), file.buffer, { flag: 'wx' });
  }

  return {
    storageKey,
    url: `/api/tickets/${ticketId}/attachments/${storageKey}`,
    filename: cleanDisplayName(file.originalname, detected.ext),
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

  const ext = storageKey.split('.').pop();
  const mimeType = Object.entries(ALLOWED_IMAGE_TYPES).find(([, e]) => e === ext)?.[0];

  if (isCloudinaryConfigured) {
    const publicId = `supportdesk/${ticketId}/${path.parse(storageKey).name}`;
    const cloudinaryUrl = cloudinary.url(publicId, { secure: true, format: ext });

    return new Promise((resolve, reject) => {
      https
        .get(cloudinaryUrl, (res) => {
          if (res.statusCode !== 200) {
            return reject(ApiError.notFound('Attachment not found'));
          }
          const size = Number(res.headers['content-length'] || 0);
          resolve({ stream: res, size, mimeType });
        })
        .on('error', () => reject(ApiError.notFound('Attachment not found')));
    });
  }

  const filePath = path.join(ticketDir(ticketId), storageKey);

  try {
    const stats = await fs.stat(filePath);
    return { stream: createReadStream(filePath), size: stats.size, mimeType };
  } catch {
    throw ApiError.notFound('Attachment not found');
  }
}

/** Best-effort cleanup when a message write fails after the file was saved. */
export async function removeTicketImage({ ticketId, storageKey }) {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) return;

  if (isCloudinaryConfigured) {
    const publicId = `supportdesk/${ticketId}/${path.parse(storageKey).name}`;
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  } else {
    await fs.rm(path.join(ticketDir(ticketId), storageKey), { force: true });
  }
}

/** Used by `db:reset` so wiping the database also wipes orphaned photos. */
export async function removeAllUploads() {
  if (!isCloudinaryConfigured) {
    await fs.rm(UPLOADS_DIR, { recursive: true, force: true });
  }
}

