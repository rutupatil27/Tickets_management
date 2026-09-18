import { Notification } from '../models/Notification.js';
import { SOCKET_EVENTS } from '../config/constants.js';
import { emitToUser } from '../sockets/realtime.js';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Persist an in-app notification and push it over Socket.IO.
 * Notification delivery must never break the operation that triggered it, so
 * failures are logged rather than thrown.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  ticket = null,
}) {
  if (!userId) return null;

  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      relatedTicketId: ticket?._id ?? null,
      relatedTicketNumber: ticket?.ticketNumber ?? '',
    });

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      notification: notification.toJSON(),
      unreadCount,
    });

    return notification;
  } catch (error) {
    logger.error('Failed to create notification:', error.message);
    return null;
  }
}

export async function createNotifications(entries = []) {
  return Promise.all(entries.map((entry) => createNotification(entry)));
}

export async function listNotifications(userId, query = {}) {
  const { page, limit, skip } = resolvePagination(query);

  const filter = { userId };
  if (query.isRead === 'true') filter.isRead = true;
  if (query.isRead === 'false') filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true } },
    { new: true },
  );

  if (!notification) throw ApiError.notFound('Notification not found');

  const unreadCount = await Notification.countDocuments({ userId, isRead: false });
  return { notification, unreadCount };
}

export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } },
  );
  return { modified: result.modifiedCount ?? 0, unreadCount: 0 };
}

export function getUnreadCount(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}
