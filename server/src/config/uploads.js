import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Defaults to server/uploads; UPLOADS_DIR overrides it (the test suite uses a temp dir). */
export const UPLOADS_DIR = env.UPLOADS_DIR
  ? path.resolve(env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Images only, and deliberately no SVG: an SVG can carry script, and we serve
 * attachments from the API origin.
 */
export const ALLOWED_IMAGE_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
});

export const ALLOWED_EXTENSIONS = Object.freeze(Object.values(ALLOWED_IMAGE_TYPES));

/**
 * Magic-byte signatures. The browser-supplied mime type and the file extension
 * are both attacker-controlled, so the real bytes are what we trust.
 */
const SIGNATURES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png',
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

/** Returns { ext, mime } when the buffer really is a supported image. */
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((signature) => signature.test(buffer)) ?? null;
}

/** Stored filenames are generated, never taken from the client. */
export const STORAGE_KEY_PATTERN = new RegExp(`^[a-f0-9]{32}\\.(${ALLOWED_EXTENSIONS.join('|')})$`);
