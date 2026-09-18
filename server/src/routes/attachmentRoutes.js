import { Router } from 'express';
import * as messageController from '../controllers/messageController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { attachmentParams } from '../validators/messageValidators.js';

// Mounted at /api/tickets/:ticketId/attachments, behind `authenticate`.
const router = Router({ mergeParams: true });

router.get('/:storageKey', validate({ params: attachmentParams }), messageController.streamAttachment);

export default router;
