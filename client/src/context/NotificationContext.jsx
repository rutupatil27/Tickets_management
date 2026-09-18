import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import notificationApi from '../services/notificationApi.js';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { SOCKET_EVENTS } from '../utils/constants.js';

export const NotificationContext = createContext(null);

/**
 * In-app notification centre (spec §29/§72).
 * History comes from REST, live arrivals come from Socket.IO.
 */
export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { subscribe } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const { data } = await notificationApi.list({ limit: 20 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // A failed notification poll should never interrupt the user.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    refresh();
  }, [isAuthenticated, refresh]);

  // Live arrivals push straight into the list and raise a toast.
  useEffect(
    () =>
      subscribe(SOCKET_EVENTS.NOTIFICATION_NEW, ({ notification, unreadCount: count }) => {
        setNotifications((current) => [notification, ...current].slice(0, 30));
        setUnreadCount(count);
        toast(notification.title, { icon: '🔔' });
      }),
    [subscribe],
  );

  const markRead = useCallback(async (id) => {
    // Optimistic: the badge should react instantly, the request confirms it.
    setNotifications((current) =>
      current.map((item) => (item._id === id ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      const { data } = await notificationApi.markRead(id);
      setUnreadCount(data.unreadCount);
    } catch {
      // Fall back to the server's truth if the write failed.
      notificationApi.list({ limit: 20 }).then(({ data }) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationApi.markAllRead();
    } catch {
      // ignore - next refresh reconciles
    }
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, refresh, markRead, markAllRead }),
    [notifications, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
