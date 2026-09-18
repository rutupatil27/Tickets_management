import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import cn from '../../utils/cn.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import { EmptyState, LoadingState } from '../../components/common/States.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useAuth } from '../../hooks/useAuth.js';
import { formatRelative } from '../../utils/format.js';
import { ROLE_BASE_PATH } from '../../utils/constants.js';

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();
  const { role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = (notification) => {
    if (!notification.isRead) markRead(notification._id);
    if (notification.relatedTicketId) {
      navigate(`${ROLE_BASE_PATH[role]}/tickets/${notification.relatedTicketId}`);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
            : 'You are all caught up.'
        }
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" icon={CheckCheck} onClick={markAllRead}>
              Mark all read
            </Button>
          )
        }
      />

      <Card padded={false}>
        {loading && notifications.length === 0 ? (
          <LoadingState label="Loading notifications..." />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="Ticket assignments, new replies and status changes will show up here."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {notifications.map((notification) => (
              <li key={notification._id}>
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className={cn(
                    'flex w-full items-start gap-3.5 px-5 py-4 text-left transition hover:bg-ink-50 sm:px-6',
                    !notification.isRead && 'bg-brand-50/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold',
                      notification.isRead ? 'bg-ink-100 text-ink-500' : 'bg-brand-100 text-brand-700',
                    )}
                  >
                    {notification.relatedTicketNumber?.replace('SD-', '#') || <Bell className="h-4 w-4" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink-900">{notification.title}</span>
                      {!notification.isRead && (
                        <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          NEW
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block break-anywhere text-sm text-ink-600">
                      {notification.message}
                    </span>
                    <span className="mt-1.5 block text-[11px] text-ink-400">
                      {formatRelative(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
