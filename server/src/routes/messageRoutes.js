import { Router } from 'express';
import * as messageController from '../controllers/messageController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { singleImage } from '../middleware/uploadMiddleware.js';
import { ticketIdParam } from '../validators/common.js';
import {
  createMessageSchema,
  listMessagesQuerySchema,
  photoMessageSchema,
} from '../validators/messageValidators.js';

// mergeParams so `:ticketId` from the parent ticket router is visible here.
const router = Router({ mergeParams: true });

router.get(
  '/',
  validate({ params: ticketIdParam, query: listMessagesQuerySchema }),
  messageController.list,
);

router.post(
  '/',
  validate({ params: ticketIdParam, body: createMessageSchema }),
  messageController.create,
);

// Photo message. Order matters: reject a bad ticket id before reading the
// upload, then let multer parse the multipart body, then validate the caption.
router.post(
  '/photo',
  validate({ params: ticketIdParam }),
  singleImage('image'),
  validate({ body: photoMessageSchema }),
  messageController.createPhoto,
);

router.patch('/read', validate({ params: ticketIdParam }), messageController.markRead);

export default router;
