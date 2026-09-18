import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useSocket } from '../../hooks/useSocket.js';
import ticketApi from '../../services/ticketApi.js';
import { ACTIVE_TICKET_STATUSES, ROLES, SOCKET_EVENTS, TICKET_STATUS } from '../../utils/constants.js';

/**
 * The authenticated shell: role-aware sidebar + header + routed content.
 * Every role reuses this layout instead of having its own app (spec §40).
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { subscribe } = useSocket();
  const navigate = useNavigate();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [counts, setCounts] = useState({ openTickets: 0, activeTickets: 0, waitingTickets: 0 });

  // Sidebar badges - one lightweight count query, refreshed on live events.
  const loadCounts = useCallback(async () => {
    if (!user) return;

    try {
      if (user.role === ROLES.CUSTOMER) {
        const { data } = await ticketApi.list({
          limit: 1,
          status: [TICKET_STATUS.OPEN, TICKET_STATUS.WAITING_FOR_AGENT, TICKET_STATUS.ASSIGNED],
        });
        setCounts((current) => ({ ...current, openTickets: data.pagination.total }));
      } else if (user.role === ROLES.AGENT) {
        const { data } = await ticketApi.list({ limit: 1, status: ACTIVE_TICKET_STATUSES });
        setCounts((current) => ({ ...current, activeTickets: data.pagination.total }));
      } else {
        const { data } = await ticketApi.list({
          limit: 1,
          status: [TICKET_STATUS.WAITING_FOR_AGENT, TICKET_STATUS.OPEN],
        });
        setCounts((current) => ({ ...current, waitingTickets: data.pagination.total }));
      }
    } catch {
      // Badge counts are decorative - never block the shell on them.
    }
  }, [user]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    const unsubscribers = [
      subscribe(SOCKET_EVENTS.TICKET_UPDATED, loadCounts),
      subscribe(SOCKET_EVENTS.TICKET_ASSIGNED, loadCounts),
      subscribe(SOCKET_EVENTS.TICKET_STATUS_CHANGED, loadCounts),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [subscribe, loadCounts]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const badges = useMemo(
    () => ({ ...counts, unreadNotifications: unreadCount }),
    [counts, unreadCount],
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto flex max-w-[1680px] gap-4 p-3 sm:p-4">
        <Sidebar
          user={user}
          badges={badges}
          onLogout={handleLogout}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Topbar
            user={user}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onLogout={handleLogout}
          />
          <main className="min-w-0 flex-1 pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
