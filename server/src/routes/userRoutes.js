import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { ROLES } from '../config/constants.js';
import { idParam } from '../validators/common.js';
import {
  createAgentSchema,
  listUsersQuerySchema,
  updateActiveSchema,
  updateAvailabilitySchema,
  updateRoleSchema,
  updateUserSchema,
} from '../validators/userValidators.js';

const router = Router();

router.use(authenticate);

// Staff can see the agent roster (used by the admin reassign dialog).
router
  .route('/agents')
  .get(authorize(ROLES.AGENT, ROLES.ADMIN), userController.agents)
  // The only way an admin adds an account. Customers sign up via /auth/register.
  .post(authorize(ROLES.ADMIN), validate({ body: createAgentSchema }), userController.createAgentAccount);
router.get('/agents/workload', authorize(ROLES.ADMIN), userController.agentWorkload);

router.get('/', authorize(ROLES.ADMIN), validate({ query: listUsersQuerySchema }), userController.list);

router.get('/:id', validate({ params: idParam }), userController.getOne);

router.patch('/:id', validate({ params: idParam, body: updateUserSchema }), userController.update);

router.patch(
  '/:id/role',
  authorize(ROLES.ADMIN),
  validate({ params: idParam, body: updateRoleSchema }),
  userController.changeRole,
);

router.patch(
  '/:id/active',
  authorize(ROLES.ADMIN),
  validate({ params: idParam, body: updateActiveSchema }),
  userController.changeActiveStatus,
);

// Agents change their own availability; admins may change anyone's.
router.patch(
  '/:id/availability',
  authorize(ROLES.AGENT, ROLES.ADMIN),
  validate({ params: idParam, body: updateAvailabilitySchema }),
  userController.changeAvailability,
);

export default router;
