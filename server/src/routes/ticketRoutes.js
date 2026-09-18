import { Router } from 'express';
import * as ticketController from '../controllers/ticketController.js';
import messageRoutes from './messageRoutes.js';
import attachmentRoutes from './attachmentRoutes.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { ROLES } from '../config/constants.js';
import { idParam } from '../validators/common.js';
import {
  createTicketSchema,
  listTicketsQuerySchema,
  reassignSchema,
  updatePrioritySchema,
  updateStatusSchema,
} from '../validators/ticketValidators.js';

const router = Router();

// Every ticket route requires a valid token; row-level access is then enforced
// inside the service layer via assertTicketAccess (spec §75 rules 1-3).
router.use(authenticate);

router.get('/meta', ticketController.meta);

router
  .route('/')
  .get(validate({ query: listTicketsQuerySchema }), ticketController.list)
  .post(authorize(ROLES.CUSTOMER, ROLES.ADMIN), validate({ body: createTicketSchema }), ticketController.create);

router.get('/:id', validate({ params: idParam }), ticketController.getOne);

router.get(
  '/:id/history',
  authorize(ROLES.AGENT, ROLES.ADMIN),
  validate({ params: idParam }),
  ticketController.history,
);

router.patch(
  '/:id/status',
  validate({ params: idParam, body: updateStatusSchema }),
  ticketController.updateStatus,
);

router.patch(
  '/:id/priority',
  authorize(ROLES.AGENT, ROLES.ADMIN),
  validate({ params: idParam, body: updatePrioritySchema }),
  ticketController.updatePriority,
);

router.patch(
  '/:id/reassign',
  authorize(ROLES.ADMIN),
  validate({ params: idParam, body: reassignSchema }),
  ticketController.reassign,
);

// /api/tickets/:ticketId/messages
router.use('/:ticketId/messages', messageRoutes);

// /api/tickets/:ticketId/attachments/:storageKey - authorized photo streaming
router.use('/:ticketId/attachments', attachmentRoutes);

export default router;
