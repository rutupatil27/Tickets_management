import {
  Bell,
  Headset,
  LayoutDashboard,
  ShieldCheck,
  Ticket,
  UserCircle,
  Users,
} from 'lucide-react';

/** Sidebar for the ADMIN role. */
export const adminNavigation = [
  {
    section: 'Menu',
    items: [
      {
        label: 'Dashboard',
        to: '/admin/dashboard',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'All Tickets',
        to: '/admin/tickets',
        icon: Ticket,
        badge: 'waitingTickets',
      },
    ],
  },
  {
    section: 'Agents & Users',
    items: [
      {
        label: 'Agents',
        to: '/admin/agents',
        icon: Headset,
      },
      {
        label: 'Manage Users',
        to: '/admin/users',
        icon: Users,
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        label: 'Notifications',
        to: '/admin/notifications',
        icon: Bell,
        badge: 'unreadNotifications',
      },
      {
        label: 'Profile',
        to: '/admin/profile',
        icon: UserCircle,
      },
    ],
  },
];

export const adminQuickAction = {
  label: 'Review queue',
  to: '/admin/tickets?unassigned=true',
  icon: ShieldCheck,
};

export default adminNavigation;
