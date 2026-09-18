import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { signToken } from '../utils/jwt.js';
import { ERROR_CODES, ROLES } from '../config/constants.js';
import { updateUserProfile } from '../services/userService.js';
import { getUnreadCount } from '../services/notificationService.js';

/**
 * POST /api/auth/register
 * Self-registration always creates a customer - `role` in the body is rejected
 * by the schema, so nobody can register themselves as an agent or admin.
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', ERROR_CODES.EMAIL_IN_USE);
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: ROLES.CUSTOMER });

  const token = signToken(user);

  return sendCreated(res, {
    message: 'Account created successfully',
    data: { user: user.toJSON(), token },
  });
});

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // `passwordHash` is `select: false` on the schema, so ask for it explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');

  // Identical message for "no such user" and "wrong password" so the endpoint
  // cannot be used to enumerate registered email addresses.
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw ApiError.forbidden(
      'Your account has been deactivated. Please contact an administrator.',
      ERROR_CODES.ACCOUNT_INACTIVE,
    );
  }

  const matches = await user.comparePassword(password);
  if (!matches) {
    throw ApiError.unauthorized('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS);
  }

  user.lastSeenAt = new Date();
  await user.save();

  const token = signToken(user);

  return sendSuccess(res, {
    message: `Welcome back, ${user.name.split(' ')[0]}`,
    data: { user: user.toJSON(), token },
  });
});

/** GET /api/auth/me */
export const getMe = asyncHandler(async (req, res) => {
  const unreadNotifications = await getUnreadCount(req.user._id);

  return sendSuccess(res, {
    message: 'Current user',
    data: { user: req.user.toJSON(), unreadNotifications },
  });
});

/**
 * POST /api/auth/logout
 * JWTs are stateless, so this exists to update presence and give the client a
 * single place to call; the client discards the token.
 */
export const logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { lastSeenAt: new Date() } });
  return sendSuccess(res, { message: 'Logged out successfully' });
});

/** PATCH /api/auth/profile */
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await updateUserProfile({
    actor: req.user,
    userId: req.user._id,
    payload: req.body,
  });

  return sendSuccess(res, { message: 'Profile updated successfully', data: { user } });
});

/** PATCH /api/auth/password */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+passwordHash');
  const matches = await user.comparePassword(currentPassword);

  if (!matches) {
    throw ApiError.badRequest('Current password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  }

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  return sendSuccess(res, { message: 'Password changed successfully' });
});
