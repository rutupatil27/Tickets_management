import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Headset,
  Inbox,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { AvailabilityBadge, PriorityBadge, StatusBadge } from '../../components/common/Badge.jsx';
import { ChartSkeleton, EmptyState, ErrorState, StatCardSkeleton } from '../../components/common/States.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import QuickOverview from '../../components/dashboard/QuickOverview.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import DonutChart from '../../components/charts/DonutChart.jsx';
import DistributionBars from '../../components/charts/DistributionBars.jsx';
import TicketsOverTimeChart from '../../components/charts/TicketsOverTimeChart.jsx';
import dashboardApi from '../../services/dashboardApi.js';
import { useSocket } from '../../hooks/useSocket.js';
import { priorityStyle, statusStyle } from '../../theme/statusStyles.js';
import { formatSmart } from '../../utils/format.js';
import {
  PRIORITY_LABELS,
  SOCKET_EVENTS,
  STATUS_LABELS,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
} from '../../utils/constants.js';

export default function AdminDashboard() {
  const { subscribe } = useSocket();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await dashboardApi.admin();
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
      subscribe(SOCKET_EVENTS.PRESENCE_UPDATE, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [subscribe, load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-40 rounded-panel" />
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

  const { stats, byStatus, byPriority, byCategory, timeline, agentWorkload, recentTickets } = data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support operations"
        subtitle="Ticket flow, agent workload and assignment health across the whole desk."
        actions={
          <>
            <Button to="/admin/agents" variant="secondary" icon={Headset}>
              Agents
            </Button>
            <Button to="/admin/tickets" icon={Inbox}>
              All tickets
            </Button>
          </>
        }
      />

      <QuickOverview
        title="Quick overview"
        subtitle="Platform-wide numbers, updated live as tickets move."
        items={[
          { label: 'Total users', value: stats.totalUsers, delta: `${stats.totalCustomers} customers` },
          { label: 'Total agents', value: stats.totalAgents, delta: `${stats.availableAgents} available` },
          { label: 'Categories', value: stats.totalCategories },
          { label: 'Total tickets', value: stats.total },
          { label: 'Waiting queue', value: stats.waiting },
        ]}
      />

      {stats.waiting > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-warning-200 bg-warning-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600" />
          <p className="min-w-0 flex-1 text-sm font-medium text-warning-700">
            {stats.waiting} ticket(s) are queued with no available agent. They will be assigned
            automatically as soon as an agent becomes available.
          </p>
          <Button to="/admin/tickets?status=WAITING_FOR_AGENT" size="sm" variant="secondary">
            Review queue
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="In progress"
          value={stats.inProgress}
          hint="Being actively worked on"
          icon={TrendingUp}
          tone="brand"
          to="/admin/tickets?status=IN_PROGRESS"
        />
        <StatCard
          label="Waiting for agent"
          value={stats.waiting}
          hint="No available agent yet"
          icon={AlertTriangle}
          tone="warning"
          to="/admin/tickets?status=WAITING_FOR_AGENT"
        />
        <StatCard
          label="Resolved"
          value={stats.resolved}
          hint="Awaiting customer confirmation"
          icon={CheckCircle2}
          tone="success"
          to="/admin/tickets?status=RESOLVED"
        />
        <StatCard
          label="Closed"
          value={stats.closed}
          hint="Completed and confirmed"
          icon={ShieldCheck}
          tone="neutral"
          to="/admin/tickets?status=CLOSED"
        />
      </div>

      <Card>
        <CardHeader
          title="Ticket volume"
          subtitle="Created vs resolved over the last 12 months"
          icon={TrendingUp}
        />
        <div className="mt-4">
          <TicketsOverTimeChart data={timeline} height={300} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Tickets by category" subtitle="What customers contact you about" />
          <div className="mt-5">
            <DonutChart
              centerLabel="Total tickets"
              data={Object.entries(byCategory).map(([name, value]) => ({ name, value }))}
            />
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 xl:grid-rows-2">
          <Card>
            <CardHeader title="By status" />
            <DistributionBars
              className="mt-4"
              items={TICKET_STATUS_VALUES.map((status) => ({
                name: STATUS_LABELS[status],
                value: byStatus[status] ?? 0,
                color: statusStyle(status).hex,
              }))}
            />
          </Card>

          <Card>
            <CardHeader title="By priority" />
            <DistributionBars
              className="mt-4"
              items={TICKET_PRIORITY_VALUES.map((priority) => ({
                name: PRIORITY_LABELS[priority],
                value: byPriority[priority] ?? 0,
                color: priorityStyle(priority).hex,
              }))}
            />
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* -------------------------------------------------- workload */}
        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-ink-900">Agent workload</h2>
              <p className="text-sm text-ink-500">Live active-ticket count per agent</p>
            </div>
            <Button to="/admin/agents" variant="secondary" size="sm">
              Manage
            </Button>
          </div>

          {agentWorkload.length === 0 ? (
            <EmptyState icon={Users} title="No agents yet" description="Create agent accounts to start routing tickets." />
          ) : (
            <div className="overflow-x-auto border-t border-ink-100">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="bg-surface-muted/60">
                    <th scope="col" className="px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-400">
                      Agent
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-400">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-ink-400">
                      Active
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-ink-400">
                      Resolved
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {agentWorkload.map((agent) => (
                    <tr key={agent._id} className={agent.isActive ? '' : 'opacity-55'}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar
                            name={agent.name}
                            src={agent.avatar}
                            size="xs"
                            availability={agent.availabilityStatus}
                            ring={false}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink-800">
                              {agent.name}
                            </span>
                            {!agent.isActive && (
                              <span className="text-[11px] font-medium text-danger-600">
                                Deactivated
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AvailabilityBadge availability={agent.availabilityStatus} size="xs" />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-ink-900">
                        {agent.activeTickets}
                      </td>
                      <td className="px-5 py-3 text-right text-sm tabular-nums text-ink-500">
                        {agent.resolvedTickets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ---------------------------------------------- recent tickets */}
        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-ink-900">Recent publications</h2>
              <p className="text-sm text-ink-500">Newest tickets across the platform</p>
            </div>
            <Button to="/admin/tickets" variant="secondary" size="sm">
              View all
            </Button>
          </div>

          {recentTickets.length === 0 ? (
            <EmptyState icon={Inbox} title="No tickets yet" />
          ) : (
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {recentTickets.map((ticket) => (
                <li key={ticket._id}>
                  <Link
                    to={`/admin/tickets/${ticket._id}`}
                    className="flex flex-wrap items-center gap-2.5 px-5 py-3 transition hover:bg-brand-50/40 sm:px-6"
                  >
                    <span className="font-mono text-xs font-bold text-brand-600">
                      {ticket.ticketNumber}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
                      {ticket.subject}
                    </span>
                    <PriorityBadge priority={ticket.priority} size="xs" />
                    <StatusBadge status={ticket.status} size="xs" />
                    <span className="w-14 shrink-0 text-right text-[11px] text-ink-400">
                      {formatSmart(ticket.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
