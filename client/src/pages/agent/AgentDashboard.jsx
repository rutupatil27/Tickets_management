import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Gauge,
  Inbox,
  MessageSquare,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { ChartSkeleton, EmptyState, ErrorState, StatCardSkeleton } from '../../components/common/States.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import AvailabilityToggle from '../../components/layout/AvailabilityToggle.jsx';
import QuickOverview from '../../components/dashboard/QuickOverview.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import DistributionBars from '../../components/charts/DistributionBars.jsx';
import TicketsOverTimeChart from '../../components/charts/TicketsOverTimeChart.jsx';
import dashboardApi from '../../services/dashboardApi.js';
import { useSocket } from '../../hooks/useSocket.js';
import { useAuth } from '../../hooks/useAuth.js';
import { priorityStyle } from '../../theme/statusStyles.js';
import { formatSmart } from '../../utils/format.js';
import {
  AVAILABILITY,
  PRIORITY_LABELS,
  SOCKET_EVENTS,
  TICKET_PRIORITY_VALUES,
} from '../../utils/constants.js';

export default function AgentDashboard() {
  const { user } = useAuth();
  const { subscribe } = useSocket();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await dashboardApi.agent();
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

  useEffect(() => {
    const refresh = () => load({ silent: true });
    const unsubscribers = [
      subscribe(SOCKET_EVENTS.TICKET_UPDATED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_ASSIGNED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_STATUS_CHANGED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_MESSAGE_NEW, refresh),
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

  const { stats, byPriority, timeline, myTickets } = data;
  const isOffline = user.availabilityStatus !== AVAILABILITY.AVAILABLE;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My workspace"
        subtitle="Your queue, your workload and how the wider desk is doing."
        actions={<AvailabilityToggle />}
      />

      {isOffline && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-warning-200 bg-warning-50 p-4">
          <Gauge className="h-5 w-5 shrink-0 text-warning-600" />
          <p className="min-w-0 flex-1 text-sm font-medium text-warning-700">
            You are {user.availabilityStatus}. New tickets will not be assigned to you automatically
            {stats.waitingQueue > 0 && ` - ${stats.waitingQueue} ticket(s) are waiting in the queue`}.
          </p>
        </div>
      )}

      <QuickOverview
        title="Quick overview"
        subtitle="A snapshot of your current support workload."
        items={[
          { label: 'Active tickets', value: stats.activeTickets },
          { label: 'In progress', value: stats.inProgress },
          { label: 'Waiting on customer', value: stats.waitingForCustomer },
          { label: 'Resolved today', value: stats.resolvedToday },
          { label: 'Queue waiting', value: stats.waitingQueue },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active tickets"
          value={stats.activeTickets}
          hint="Counted towards your workload"
          icon={Inbox}
          tone="brand"
          to="/agent/tickets"
        />
        <StatCard
          label="Waiting for customer"
          value={stats.waitingForCustomer}
          hint="Blocked until they reply"
          icon={Timer}
          tone="warning"
          to="/agent/tickets?status=WAITING_FOR_CUSTOMER"
        />
        <StatCard
          label="Resolved today"
          value={stats.resolvedToday}
          hint={`${stats.resolved} resolved all time`}
          icon={CheckCircle2}
          tone="success"
          to="/agent/tickets?status=RESOLVED"
        />
        <StatCard
          label="Unread messages"
          value={stats.unreadMessages}
          hint="Across your assigned tickets"
          icon={MessageSquare}
          tone="info"
          to="/agent/tickets"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="My ticket volume"
            subtitle="Assigned to you over the last 6 months"
            icon={TrendingUp}
          />
          <div className="mt-4">
            <TicketsOverTimeChart data={timeline} height={260} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="My tickets by priority" />
            <DistributionBars
              className="mt-5"
              emptyLabel="Nothing assigned yet"
              items={TICKET_PRIORITY_VALUES.map((priority) => ({
                name: PRIORITY_LABELS[priority],
                value: byPriority[priority] ?? 0,
                color: priorityStyle(priority).hex,
              }))}
            />
          </Card>

          <Card>
            <CardHeader title="Team workload" icon={Users} />
            <dl className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <dt className="text-sm text-ink-500">Average active per agent</dt>
                <dd className="text-lg font-extrabold tabular-nums text-ink-900">
                  {stats.averageWorkload}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-sm text-ink-500">Your active tickets</dt>
                <dd className="text-lg font-extrabold tabular-nums text-ink-900">
                  {stats.activeTickets}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-sm text-ink-500">Unassigned in queue</dt>
                <dd className="text-lg font-extrabold tabular-nums text-ink-900">
                  {stats.waitingQueue}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-ink-900">My active queue</h2>
            <p className="text-sm text-ink-500">Highest priority first</p>
          </div>
          <Button to="/agent/tickets" variant="secondary" size="sm">
            View all
          </Button>
        </div>

        {myTickets.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No tickets assigned"
            description="You're all caught up. New tickets will arrive here automatically while you're available."
          />
        ) : (
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {myTickets.map((ticket) => (
              <li key={ticket._id}>
                <Link
                  to={`/agent/tickets/${ticket._id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/40 sm:px-6"
                >
                  <span className="font-mono text-xs font-bold text-brand-600">
                    {ticket.ticketNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
                    {ticket.subject}
                  </span>
                  {ticket.createdBy && (
                    <span className="hidden items-center gap-1.5 sm:flex">
                      <Avatar name={ticket.createdBy.name} size="xs" ring={false} />
                      <span className="text-xs text-ink-500">{ticket.createdBy.name}</span>
                    </span>
                  )}
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
