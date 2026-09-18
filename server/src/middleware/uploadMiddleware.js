import multer from 'multer';
import { ALLOWED_IMAGE_TYPES, MAX_ATTACHMENT_BYTES } from '../config/uploads.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../config/constants.js';

/**
 * Photos are held in memory only long enough to inspect their real bytes; the
 * storage service writes them to disk after that check passes, so a renamed
 * non-image never touches the filesystem.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 2 },
  fileFilter(_req, file, callback) {
    // Cheap early rejection; the magic-byte check afterwards is authoritative.
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      return callback(
        ApiError.badRequest('Only JPG, PNG, GIF or WebP photos can be shared.', ERROR_CODES.VALIDATION_ERROR),
      );
    }
    return callback(null, true);
  },
});

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: `Photos must be ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB or smaller.`,
  LIMIT_FILE_COUNT: 'Send one photo at a time.',
  LIMIT_UNEXPECTED_FILE: 'Upload the photo in the "image" field.',
};

/** Single photo in the `image` field, with multer errors mapped to 400s. */
export function singleImage(fieldName = 'image') {
  const handler = upload.single(fieldName);

  return (req, res, next) => {
    handler(req, res, (error) => {
      if (!error) return next();
      if (error instanceof ApiError) return next(error);
      if (error instanceof multer.MulterError) {
        return next(
          ApiError.badRequest(MULTER_MESSAGES[error.code] ?? error.message, ERROR_CODES.VALIDATION_ERROR),
        );
      }
      return next(error);
    });
  };
}
