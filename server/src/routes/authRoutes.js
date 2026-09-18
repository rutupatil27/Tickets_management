import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);

router.use(authenticate);

router.get('/me', authController.getMe);
router.post('/logout', authController.logout);
router.patch('/profile', validate({ body: updateProfileSchema }), authController.updateProfile);
router.patch('/password', validate({ body: changePasswordSchema }), authController.changePassword);

export default router;
