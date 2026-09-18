import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Inbox,
  PlusCircle,
  Ticket as TicketIcon,
  Timer,
} from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge.jsx';
import { ChartSkeleton, EmptyState, ErrorState, StatCardSkeleton } from '../../components/common/States.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import QuickOverview from '../../components/dashboard/QuickOverview.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import DistributionBars from '../../components/charts/DistributionBars.jsx';
import dashboardApi from '../../services/dashboardApi.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useAuth } from '../../hooks/useAuth.js';
import { statusStyle } from '../../theme/statusStyles.js';
import { formatSmart } from '../../utils/format.js';
import { SOCKET_EVENTS, STATUS_LABELS, TICKET_STATUS_VALUES } from '../../utils/constants.js';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { subscribe } = useSocket();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await dashboardApi.customer();
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Dashboard numbers stay live as tickets move through the workflow.
  useEffect(() => {
    const refresh = () => load({ silent: true });
    const unsubscribers = [
      subscribe(SOCKET_EVENTS.TICKET_UPDATED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_ASSIGNED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_STATUS_CHANGED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [subscribe, load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-36 rounded-panel" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={load} />
      </Card>
    );
  }

  const { stats, byStatus, byCategory, recentTickets } = data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My support overview"
        subtitle="Track every request you have raised and jump back into any conversation."
        actions={
          <Button to="/customer/tickets/new" icon={PlusCircle}>
            New ticket
          </Button>
        }
      />

      <QuickOverview
        title="Quick overview"
        subtitle={`Everything you have raised with our support team, ${user.name.split(' ')[0]}.`}
        items={[
          { label: 'Total tickets', value: stats.total },
          { label: 'Open', value: stats.open },
          { label: 'In progress', value: stats.inProgress },
          { label: 'Resolved', value: stats.resolved },
          { label: 'Closed', value: stats.closed },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={stats.open}
          hint="Waiting to be picked up or just assigned"
          icon={Inbox}
          tone="info"
          to="/customer/tickets?status=OPEN"
        />
        <StatCard
          label="In progress"
          value={stats.inProgress}
          hint="An agent is actively working on these"
          icon={Timer}
          tone="brand"
          to="/customer/tickets?status=IN_PROGRESS"
        />
        <StatCard
          label="Resolved"
          value={stats.resolved}
          hint="Confirm or reopen these"
          icon={CheckCircle2}
          tone="success"
          to="/customer/tickets?status=RESOLVED"
        />
        <StatCard
          label="Unread replies"
          value={stats.unreadMessages}
          hint="New messages across your tickets"
          icon={Clock}
          tone="warning"
          to="/customer/tickets"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Tickets by status"
            subtitle="Where your requests currently sit"
            icon={TicketIcon}
          />
          <DistributionBars
            className="mt-5"
            emptyLabel="No tickets raised yet"
            items={TICKET_STATUS_VALUES.map((status) => ({
              name: STATUS_LABELS[status],
              value: byStatus[status] ?? 0,
              color: statusStyle(status).hex,
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="Tickets by category" subtitle="What you contact us about" />
          <div className="mt-5">
            <DonutChart
              centerLabel="Tickets"
              data={Object.entries(byCategory).map(([name, value]) => ({ name, value }))}
            />
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-ink-900">Recent tickets</h2>
            <p className="text-sm text-ink-500">Your five most recently updated requests</p>
          </div>
          <Button to="/customer/tickets" variant="secondary" size="sm">
            View all
          </Button>
        </div>

        {recentTickets.length === 0 ? (
          <EmptyState
            icon={TicketIcon}
            title="No tickets yet"
            description="Create your first support ticket and we will assign an agent automatically."
            action={
              <Button to="/customer/tickets/new" icon={PlusCircle}>
                Create ticket
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {recentTickets.map((ticket) => (
              <li key={ticket._id}>
                <Link
                  to={`/customer/tickets/${ticket._id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/40 sm:px-6"
                >
                  <span className="font-mono text-xs font-bold text-brand-600">
                    {ticket.ticketNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
                    {ticket.subject}
                  </span>
                  <PriorityBadge priority={ticket.priority} size="xs" />
                  <StatusBadge status={ticket.status} size="xs" />
                  <span className="w-16 shrink-0 text-right text-[11px] text-ink-400">
                    {formatSmart(ticket.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
