import { Bell, LayoutDashboard, LifeBuoy, PlusCircle, Ticket, UserCircle } from 'lucide-react';

/**
 * Sidebar for the CUSTOMER role.
 *
 * `end: true` = highlight only on an exact path match.
 * Without it the item also stays highlighted on child routes, which is what we
 * want for "My Tickets" (so a ticket detail page keeps it lit). The Sidebar
 * picks the single most specific match, so /customer/tickets/new still wins
 * over /customer/tickets.
 */
export const customerNavigation = [
  {
    section: 'Menu',
    items: [
      {
        label: 'Dashboard',
        to: '/customer/dashboard',
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: 'My Tickets',
        to: '/customer/tickets',
        icon: Ticket,
        badge: 'openTickets',
      },
      {
        label: 'New Ticket',
        to: '/customer/tickets/new',
        icon: PlusCircle,
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        label: 'Notifications',
        to: '/customer/notifications',
        icon: Bell,
        badge: 'unreadNotifications',
      },
      {
        label: 'Profile',
        to: '/customer/profile',
        icon: UserCircle,
      },
    ],
  },
];

export const customerQuickAction = {
  label: 'Create ticket',
  to: '/customer/tickets/new',
  icon: PlusCircle,
};

export const customerHelp = {
  title: 'Need a hand?',
  description: 'Raise a ticket and an available agent is assigned automatically.',
  icon: LifeBuoy,
  action: { label: 'New ticket', to: '/customer/tickets/new' },
};

export default customerNavigation;
