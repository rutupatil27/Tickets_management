import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './ProtectedRoute.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import { ROLES } from '../utils/constants.js';

import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';

import CustomerDashboard from '../pages/customer/CustomerDashboard.jsx';
import CustomerTickets from '../pages/customer/CustomerTickets.jsx';
import CreateTicket from '../pages/customer/CreateTicket.jsx';

import AgentDashboard from '../pages/agent/AgentDashboard.jsx';
import AgentTickets from '../pages/agent/AgentTickets.jsx';

import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import AdminTickets from '../pages/admin/AdminTickets.jsx';
import AdminUsers from '../pages/admin/AdminUsers.jsx';
import AdminAgents from '../pages/admin/AdminAgents.jsx';

import TicketDetails from '../pages/shared/TicketDetails.jsx';
import Profile from '../pages/shared/Profile.jsx';
import NotificationsPage from '../pages/shared/NotificationsPage.jsx';
import NotFound from '../pages/shared/NotFound.jsx';
import RoleLanding from '../pages/shared/RoleLanding.jsx';

/**
 * Route table.
 *
 * Each role gets its own URL space (/customer, /agent, /admin) so links are
 * unambiguous, but the pages behind them reuse the same components wherever
 * the screen is genuinely the same (spec §40/§92.5).
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* -------------------------------------------------------- public */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* ----------------------------------------------------- protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Customer */}
          <Route element={<RoleRoute allow={[ROLES.CUSTOMER]} />}>
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/tickets" element={<CustomerTickets />} />
            <Route path="/customer/tickets/new" element={<CreateTicket />} />
            <Route path="/customer/tickets/:id" element={<TicketDetails />} />
            <Route path="/customer/notifications" element={<NotificationsPage />} />
            <Route path="/customer/profile" element={<Profile />} />
          </Route>

          {/* Agent */}
          <Route element={<RoleRoute allow={[ROLES.AGENT]} />}>
            <Route path="/agent/dashboard" element={<AgentDashboard />} />
            <Route path="/agent/tickets" element={<AgentTickets />} />
            <Route path="/agent/tickets/:id" element={<TicketDetails />} />
            <Route path="/agent/notifications" element={<NotificationsPage />} />
            <Route path="/agent/profile" element={<Profile />} />
          </Route>

          {/* Admin */}
          <Route element={<RoleRoute allow={[ROLES.ADMIN]} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/tickets" element={<AdminTickets />} />
            <Route path="/admin/tickets/:id" element={<TicketDetails />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/agents" element={<AdminAgents />} />
            <Route path="/admin/notifications" element={<NotificationsPage />} />
            <Route path="/admin/profile" element={<Profile />} />
          </Route>

          {/* Sends each role to their own dashboard. */}
          <Route path="/" element={<RoleLanding />} />
          <Route path="/dashboard" element={<RoleLanding />} />
        </Route>
      </Route>

      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
