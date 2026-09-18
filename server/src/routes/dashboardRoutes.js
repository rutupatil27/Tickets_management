import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/customer', authorize(ROLES.CUSTOMER, ROLES.ADMIN), dashboardController.customer);
router.get('/agent', authorize(ROLES.AGENT, ROLES.ADMIN), dashboardController.agent);
router.get('/admin', authorize(ROLES.ADMIN), dashboardController.admin);

export default router;
