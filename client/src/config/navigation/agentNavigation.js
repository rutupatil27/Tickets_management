import {
  Bell,
  Inbox,
  LayoutDashboard,
  ListChecks,
  UserCircle,
  Zap,
} from 'lucide-react';

/** Sidebar for the SUPPORT AGENT role. */
export const agentNavigation = [
  {
    section: 'Menu',
    items: [
      {
        label: 'Dashboard',
        to: '/agent/dashboard',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'My Tickets',
        to: '/agent/tickets',
        icon: Inbox,
        badge: 'activeTickets',
      },
      {
        // Same route, pre-filtered. The Sidebar compares query params too, so
        // only one of these two is ever highlighted.
        label: 'Resolved',
        to: '/agent/tickets?status=RESOLVED&status=CLOSED',
        icon: ListChecks,
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        label: 'Notifications',
        to: '/agent/notifications',
        icon: Bell,
        badge: 'unreadNotifications',
      },
      {
        label: 'Profile',
        to: '/agent/profile',
        icon: UserCircle,
      },
    ],
  },
];

export const agentQuickAction = {
  label: 'Go to my queue',
  to: '/agent/tickets',
  icon: Zap,
};

export default agentNavigation;
