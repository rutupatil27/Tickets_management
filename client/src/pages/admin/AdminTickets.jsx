import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TicketListView from '../../components/tickets/TicketListView.jsx';
import userApi from '../../services/userApi.js';

/** Admins get one extra filter the other roles do not: filter by agent. */
function AgentFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    userApi
      .agents()
      .then(({ data }) => setAgents(data.agents))
      .catch(() => setAgents([]));
  }, []);

  const value = searchParams.get('unassigned') === 'true' ? 'unassigned' : searchParams.get('agentId') ?? '';

  const onChange = (next) => {
    const params = new URLSearchParams(searchParams);
    params.delete('agentId');
    params.delete('unassigned');
    params.delete('page');

    if (next === 'unassigned') params.set('unassigned', 'true');
    else if (next) params.set('agentId', next);

    setSearchParams(params, { replace: true });
  };

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Filter by agent</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10"
      >
        <option value="">All agents</option>
        <option value="unassigned">Unassigned only</option>
        {agents.map((agent) => (
          <option key={agent._id} value={agent._id}>
            {agent.name} ({agent.activeTickets})
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdminTickets() {
  return (
    <TicketListView
      title="All tickets"
      subtitle="Every ticket on the platform, with assignment override available on each one."
      extraFilters={<AgentFilter />}
    />
  );
}
