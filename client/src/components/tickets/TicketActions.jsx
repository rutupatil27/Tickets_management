import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  CircleDot,
  PlayCircle,
  RotateCcw,
  UserCog,
  XCircle,
} from 'lucide-react';
import Button from '../common/Button.jsx';
import { ConfirmDialog, Modal } from '../common/Modal.jsx';
import { Select } from '../common/Field.jsx';
import ticketApi from '../../services/ticketApi.js';
import userApi from '../../services/userApi.js';
import {
  ROLES,
  STATUS_LABELS,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS,
} from '../../utils/constants.js';

/** How each allowed transition should be presented to the user. */
const ACTION_META = {
  [TICKET_STATUS.IN_PROGRESS]: {
    label: 'Start working',
    icon: PlayCircle,
    variant: 'primary',
    confirm: null,
  },
  [TICKET_STATUS.WAITING_FOR_CUSTOMER]: {
    label: 'Need customer info',
    icon: CircleDot,
    variant: 'secondary',
    confirm: null,
  },
  [TICKET_STATUS.RESOLVED]: {
    label: 'Mark resolved',
    icon: CheckCircle2,
    variant: 'success',
    confirm: {
      title: 'Mark this ticket as resolved?',
      description:
        'The customer will be notified and asked to confirm the resolution or reopen the ticket.',
    },
  },
  [TICKET_STATUS.CLOSED]: {
    label: 'Confirm & close',
    icon: CheckCircle2,
    variant: 'success',
    confirm: {
      title: 'Close this ticket?',
      description:
        'Closing confirms the issue is solved. You can still reopen it later if it comes back.',
    },
  },
  [TICKET_STATUS.REOPENED]: {
    label: 'Reopen ticket',
    icon: RotateCcw,
    variant: 'dangerSoft',
    confirm: {
      title: 'Reopen this ticket?',
      description: 'The conversation resumes and your agent is notified that the issue is back.',
    },
  },
};

function ReassignDialog({ open, onClose, ticket, onDone }) {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load as soon as the dialog opens, so the picker is never briefly empty.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    userApi
      .agents()
      .then(({ data }) => {
        if (!cancelled) setAgents(data.agents.filter((agent) => agent._id !== ticket.assignedTo?._id));
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, ticket.assignedTo?._id]);

  const submit = async () => {
    setSaving(true);
    try {
      const response = await ticketApi.reassign(ticket._id, { agentId: agentId || null });
      toast.success(response.message);
      onDone(response.data.ticket);
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reassign ticket"
      description="Overrides the automatic assignment. The change is written to the audit log."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Reassign
          </Button>
        </>
      }
    >
      <Select
        label="Assign to"
        value={agentId}
        onChange={(event) => setAgentId(event.target.value)}
        placeholder={loading ? 'Loading agents...' : 'Let the system pick the least-loaded agent'}
        disabled={loading}
        options={agents.map((agent) => ({
          value: agent._id,
          label: `${agent.name} - ${agent.activeTickets} active (${agent.availabilityStatus})`,
        }))}
        hint="Leaving this blank re-runs the automatic assignment engine."
      />
    </Modal>
  );
}

/**
 * The action bar on the ticket details page.
 *
 * The buttons come from `allowedStatuses`, which the backend computed from the
 * transition table - the UI never decides what is legal (spec §52).
 */
export function TicketActions({ ticket, allowedStatuses = [], role, onUpdated }) {
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [priority, setPriority] = useState(ticket.priority);

  const isAdmin = role === ROLES.ADMIN;
  const isStaff = role === ROLES.AGENT || isAdmin;

  const applyStatus = async (status) => {
    setSaving(true);
    try {
      const response = await ticketApi.updateStatus(ticket._id, { status });
      toast.success(response.message);
      onUpdated(response.data.ticket, response.data.allowedStatuses);
      setPending(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const changePriority = async (event) => {
    const next = event.target.value;
    const previous = priority;
    setPriority(next);

    try {
      const response = await ticketApi.updatePriority(ticket._id, next);
      toast.success(response.message);
      onUpdated(response.data.ticket);
    } catch (error) {
      setPriority(previous);
      toast.error(error.message);
    }
  };

  const handleClick = (status) => {
    const meta = ACTION_META[status];
    if (meta?.confirm) setPending(status);
    else applyStatus(status);
  };

  const pendingMeta = pending ? ACTION_META[pending] : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {allowedStatuses.map((status) => {
          const meta = ACTION_META[status] ?? {
            label: STATUS_LABELS[status],
            icon: CircleDot,
            variant: 'secondary',
          };

          return (
            <Button
              key={status}
              size="sm"
              variant={meta.variant}
              icon={meta.icon}
              disabled={saving}
              onClick={() => handleClick(status)}
            >
              {meta.label}
            </Button>
          );
        })}

        {isStaff && (
          <label className="flex items-center gap-2">
            <span className="sr-only">Priority</span>
            <select
              value={priority}
              onChange={changePriority}
              className="h-9 rounded-xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10"
            >
              {TICKET_PRIORITY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value} priority
                </option>
              ))}
            </select>
          </label>
        )}

        {isAdmin && (
          <Button size="sm" variant="secondary" icon={UserCog} onClick={() => setReassignOpen(true)}>
            Reassign
          </Button>
        )}

        {allowedStatuses.length === 0 && !isStaff && (
          <p className="flex items-center gap-1.5 text-xs text-ink-400">
            <XCircle className="h-3.5 w-3.5" />
            No actions available on this ticket right now.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => applyStatus(pending)}
        loading={saving}
        title={pendingMeta?.confirm?.title ?? 'Update ticket status?'}
        description={pendingMeta?.confirm?.description ?? ''}
        confirmLabel={pendingMeta?.label ?? 'Confirm'}
        variant={pendingMeta?.variant === 'dangerSoft' ? 'danger' : 'primary'}
      />

      {isAdmin && (
        <ReassignDialog
          open={reassignOpen}
          onClose={() => setReassignOpen(false)}
          ticket={ticket}
          onDone={(updated) => onUpdated(updated)}
        />
      )}
    </>
  );
}

export default TicketActions;
