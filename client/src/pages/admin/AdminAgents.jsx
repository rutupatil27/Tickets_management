import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Activity, Gauge, Headset, ShieldOff, UserCheck, UserPlus, Users } from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { AvailabilityBadge } from '../../components/common/Badge.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import CreateAgentModal from '../../components/users/CreateAgentModal.jsx';
import { EmptyState, ErrorState, StatCardSkeleton } from '../../components/common/States.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import userApi from '../../services/userApi.js';
import { useSocket } from '../../hooks/useSocket.js';
import { availabilityStyle } from '../../theme/statusStyles.js';
import { formatRelative } from '../../utils/format.js';
import { AVAILABILITY, AVAILABILITY_OPTIONS, SOCKET_EVENTS } from '../../utils/constants.js';

export default function AdminAgents() {
  const { subscribe } = useSocket();

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await userApi.agentWorkload();
      setAgents(data.agents);
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
      subscribe(SOCKET_EVENTS.PRESENCE_UPDATE, refresh),
      subscribe(SOCKET_EVENTS.TICKET_ASSIGNED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_STATUS_CHANGED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [subscribe, load]);

  const summary = useMemo(() => {
    const active = agents.filter((agent) => agent.isActive);
    const totalActiveTickets = agents.reduce((sum, agent) => sum + agent.activeTickets, 0);

    return {
      total: agents.length,
      available: active.filter((agent) => agent.availabilityStatus === AVAILABILITY.AVAILABLE).length,
      busy: active.filter((agent) => agent.availabilityStatus === AVAILABILITY.BUSY).length,
      averageLoad: agents.length ? (totalActiveTickets / agents.length).toFixed(1) : '0.0',
    };
  }, [agents]);

  const maxLoad = Math.max(1, ...agents.map((agent) => agent.activeTickets));

  const changeAvailability = async (agent, availabilityStatus) => {
    try {
      const response = await userApi.setAvailability(agent._id, availabilityStatus);
      toast.success(response.message);
      load({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmToggleActive = async () => {
    setSaving(true);
    try {
      const response = await userApi.setActive(pending._id, !pending.isActive);
      toast.success(response.message);
      setPending(null);
      load({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support agents"
        subtitle="Availability drives automatic assignment - only available, active agents receive new tickets."
        actions={
          <>
            <Button to="/admin/users" variant="secondary" icon={Users}>
              Manage users
            </Button>
            <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
              Add agent
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total agents" value={summary.total} hint="All agent accounts" icon={Headset} tone="brand" />
        <StatCard label="Available now" value={summary.available} hint="Eligible for auto-assignment" icon={UserCheck} tone="success" />
        <StatCard label="Busy" value={summary.busy} hint="Keeping current tickets only" icon={Activity} tone="warning" />
        <StatCard label="Average workload" value={summary.averageLoad} hint="Active tickets per agent" icon={Gauge} tone="info" />
      </div>

      <Card padded={false}>
        <div className="px-5 py-4 sm:px-6">
          <CardHeader
            title="Workload distribution"
            subtitle="The assignment engine always picks the available agent with the fewest active tickets."
          />
        </div>

        {agents.length === 0 ? (
          <EmptyState
            icon={Headset}
            title="No agents yet"
            description="Add your first support agent to start routing tickets automatically."
            action={
              <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
                Add agent
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {agents.map((agent) => (
              <li
                key={agent._id}
                className={`px-5 py-4 sm:px-6 ${agent.isActive ? '' : 'bg-danger-50/30'}`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar
                    name={agent.name}
                    src={agent.avatar}
                    size="md"
                    availability={agent.availabilityStatus}
                    ring={false}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-ink-800">{agent.name}</span>
                      {!agent.isActive && (
                        <span className="rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-bold text-danger-700">
                          DEACTIVATED
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-500">{agent.email}</p>
                    {agent.lastSeenAt && (
                      <p className="text-[11px] text-ink-400">
                        Last seen {formatRelative(agent.lastSeenAt)}
                      </p>
                    )}
                  </div>

                  <div className="w-full sm:w-56">
                    <div className="mb-1.5 flex items-baseline justify-between text-xs">
                      <span className="text-ink-500">Active tickets</span>
                      <span className="font-bold tabular-nums text-ink-900">
                        {agent.activeTickets}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max((agent.activeTickets / maxLoad) * 100, agent.activeTickets ? 4 : 0)}%`,
                          backgroundColor: availabilityStyle(agent.availabilityStatus).hex,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {agent.resolvedTickets} resolved all time
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <AvailabilityBadge availability={agent.availabilityStatus} />

                    <select
                      value={agent.availabilityStatus}
                      onChange={(event) => changeAvailability(agent, event.target.value)}
                      disabled={!agent.isActive}
                      aria-label={`Availability for ${agent.name}`}
                      className="h-9 rounded-xl border border-ink-200 bg-white px-2.5 text-xs font-semibold text-ink-700 outline-none transition focus:border-brand-300 disabled:opacity-50"
                    >
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <Button
                      size="xs"
                      variant={agent.isActive ? 'dangerSoft' : 'soft'}
                      icon={agent.isActive ? ShieldOff : UserCheck}
                      onClick={() => setPending(agent)}
                    >
                      {agent.isActive ? 'Deactivate' : 'Activate'}
                    </Button>

                    <Link
                      to={`/admin/tickets?agentId=${agent._id}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                    >
                      View tickets
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateAgentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load({ silent: true })}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirmToggleActive}
        loading={saving}
        variant={pending?.isActive ? 'danger' : 'primary'}
        confirmLabel={pending?.isActive ? 'Deactivate' : 'Activate'}
        title={pending?.isActive ? `Deactivate ${pending?.name}?` : `Activate ${pending?.name}?`}
        description={
          pending?.isActive
            ? `They will stop receiving new tickets and cannot sign in. Their ${pending?.activeTickets ?? 0} active ticket(s) stay assigned - reassign them from the ticket page if needed.`
            : 'They will be able to sign in and set themselves available again.'
        }
      />
    </div>
  );
}
