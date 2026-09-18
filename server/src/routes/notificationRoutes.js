import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { idParam } from '../validators/common.js';
import { listNotificationsQuerySchema } from '../validators/notificationValidators.js';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate({ params: idParam }), notificationController.markRead);

export default router;
