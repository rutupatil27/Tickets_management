import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.js';

/** GET /api/notifications */
export const list = asyncHandler(async (req, res) => {
  const data = await listNotifications(req.user._id, req.query);
  return sendSuccess(res, { message: 'Notifications fetched', data });
});

/** PATCH /api/notifications/:id/read */
export const markRead = asyncHandler(async (req, res) => {
  const data = await markNotificationRead(req.user._id, req.params.id);
  return sendSuccess(res, { message: 'Notification marked as read', data });
});

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req, res) => {
  const data = await markAllNotificationsRead(req.user._id);
  return sendSuccess(res, { message: 'All notifications marked as read', data });
});
