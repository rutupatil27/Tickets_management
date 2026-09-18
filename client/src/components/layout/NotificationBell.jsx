import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import cn from '../../utils/cn.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useAuth } from '../../hooks/useAuth.js';
import { formatRelative } from '../../utils/format.js';
import { ROLE_BASE_PATH } from '../../utils/constants.js';
import { EmptyState } from '../common/States.jsx';

const TYPE_TONE = {
  TICKET_ASSIGNED: 'bg-brand-100 text-brand-700',
  TICKET_REASSIGNED: 'bg-brand-100 text-brand-700',
  NEW_MESSAGE: 'bg-info-100 text-info-700',
  STATUS_CHANGED: 'bg-ink-100 text-ink-600',
  TICKET_RESOLVED: 'bg-success-100 text-success-700',
  TICKET_CLOSED: 'bg-ink-100 text-ink-600',
  TICKET_REOPENED: 'bg-danger-100 text-danger-700',
  TICKET_WAITING: 'bg-warning-100 text-warning-700',
};

/** Header dropdown listing in-app notifications (spec §72). */
export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const openNotification = (notification) => {
    if (!notification.isRead) markRead(notification._id);
    setOpen(false);
    if (notification.relatedTicketId) {
      navigate(`${ROLE_BASE_PATH[role]}/tickets/${notification.relatedTicketId}`);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-in overflow-hidden rounded-card border border-ink-200/70 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink-900">Notifications</p>
              <p className="text-xs text-ink-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications"
                description="Assignments, replies and status changes will show up here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {notifications.map((notification) => (
                  <li key={notification._id}>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left transition hover:bg-ink-50',
                        !notification.isRead && 'bg-brand-50/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold',
                          TYPE_TONE[notification.type] ?? 'bg-ink-100 text-ink-600',
                        )}
                      >
                        {notification.relatedTicketNumber?.replace('SD-', '#') || '•'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink-800">
                            {notification.title}
                          </span>
                          {!notification.isRead && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          )}
                        </span>
                        <span className="mt-0.5 block break-anywhere text-xs text-ink-500">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[11px] text-ink-400">
                          {formatRelative(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
