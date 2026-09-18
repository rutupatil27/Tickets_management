import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge.jsx';
import { ErrorState, LoadingState } from '../../components/common/States.jsx';
import ChatPanel from '../../components/chat/ChatPanel.jsx';
import TicketSidebar from '../../components/tickets/TicketSidebar.jsx';
import TicketActions from '../../components/tickets/TicketActions.jsx';
import ticketApi from '../../services/ticketApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useSocket } from '../../hooks/useSocket.js';
import { formatRelative } from '../../utils/format.js';
import { ROLES, ROLE_BASE_PATH, SOCKET_EVENTS, TICKET_STATUS } from '../../utils/constants.js';

export default function TicketDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [allowedStatuses, setAllowedStatuses] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const basePath = ROLE_BASE_PATH[user.role];
  const isStaff = user.role === ROLES.AGENT || user.role === ROLES.ADMIN;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await ticketApi.get(id);
      setTicket(data.ticket);
      setAllowedStatuses(data.allowedStatuses ?? []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Assignment history is staff-only; a 403 here is expected for customers.
  useEffect(() => {
    if (!isStaff || !id) return;
    ticketApi
      .history(id)
      .then(({ data }) => setHistory(data.history))
      .catch(() => setHistory([]));
  }, [id, isStaff, ticket?.assignedTo?._id]);

  /* ------------------------------------------------------- live updates */
  useEffect(() => {
    const applyIfSameTicket = (incoming) => {
      if (!incoming || incoming._id !== id) return;
      setTicket(incoming);
    };

    const unsubscribers = [
      subscribe(SOCKET_EVENTS.TICKET_STATUS_CHANGED, (payload) => {
        if (payload.ticket?._id !== id) return;
        setTicket(payload.ticket);
        // The transition table depends on the new status, so re-ask the server.
        ticketApi
          .get(id)
          .then(({ data }) => setAllowedStatuses(data.allowedStatuses ?? []))
          .catch(() => {});
      }),
      subscribe(SOCKET_EVENTS.TICKET_UPDATED, (payload) => applyIfSameTicket(payload.ticket)),
      subscribe(SOCKET_EVENTS.TICKET_ASSIGNED, (payload) => applyIfSameTicket(payload.ticket)),
    ];

    return () => unsubscribers.forEach((off) => off());
  }, [subscribe, id]);

  const handleUpdated = useCallback((updated, nextAllowed) => {
    setTicket(updated);
    if (nextAllowed) setAllowedStatuses(nextAllowed);
  }, []);

  if (loading) {
    return (
      <Card className="min-h-[24rem]">
        <LoadingState label="Loading ticket..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="min-h-[24rem]">
        <ErrorState
          title={error.status === 403 ? 'You do not have access to this ticket' : 'Ticket unavailable'}
          message={error.message}
          onRetry={error.status === 403 ? undefined : load}
        />
        <div className="flex justify-center pb-8">
          <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate(`${basePath}/tickets`)}>
            Back to tickets
          </Button>
        </div>
      </Card>
    );
  }

  const isResolvedAwaitingCustomer =
    ticket.status === TICKET_STATUS.RESOLVED && user.role === ROLES.CUSTOMER;

  return (
    <div className="space-y-4">
      <Link
        to={`${basePath}/tickets`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      {/* ----------------------------------------------------------- head */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-brand-600">
                {ticket.ticketNumber}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="mt-2 break-anywhere text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
              {ticket.subject}
            </h1>
            <p className="mt-1 text-xs text-ink-400">
              Opened {formatRelative(ticket.createdAt)}
              {ticket.lastMessageAt && ` · last reply ${formatRelative(ticket.lastMessageAt)}`}
            </p>
          </div>
        </div>

        <p className="break-anywhere whitespace-pre-wrap rounded-xl bg-surface-muted p-4 text-sm leading-relaxed text-ink-600">
          {ticket.description}
        </p>

        {isResolvedAwaitingCustomer && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success-200 bg-success-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" />
            <p className="min-w-0 flex-1 text-sm font-medium text-success-700">
              Your issue has been marked as resolved. Please confirm, or reopen it if the problem is
              still there.
            </p>
          </div>
        )}

        <div className="border-t border-ink-100 pt-4">
          <TicketActions
            ticket={ticket}
            allowedStatuses={allowedStatuses}
            role={user.role}
            onUpdated={handleUpdated}
          />
        </div>
      </Card>

      {/* ------------------------------------------------- chat + details */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card padded={false} className="flex h-[clamp(28rem,68vh,44rem)] flex-col overflow-hidden">
          <ChatPanel ticket={ticket} className="flex-1" />
        </Card>

        <TicketSidebar ticket={ticket} role={user.role} history={history} />
      </div>
    </div>
  );
}
