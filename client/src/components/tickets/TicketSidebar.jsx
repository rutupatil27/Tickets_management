import { useState } from 'react';
import { ChevronDown, History, Mail, Tag, User2 } from 'lucide-react';
import cn from '../../utils/cn.js';
import Avatar from '../common/Avatar.jsx';
import { AvailabilityBadge, PriorityBadge, StatusBadge } from '../common/Badge.jsx';
import { formatDateTime, formatRelative } from '../../utils/format.js';
import { ROLES } from '../../utils/constants.js';

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm text-ink-700">{children}</dd>
    </div>
  );
}

function PersonBlock({ title, person, icon: Icon, emptyLabel, showAvailability }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {person ? (
        <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
          <Avatar
            name={person.name}
            src={person.avatar}
            size="md"
            availability={showAvailability ? person.availabilityStatus : undefined}
            ring={false}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink-800">{person.name}</p>
            {person.email && (
              <p className="flex items-center gap-1 truncate text-xs text-ink-500">
                <Mail className="h-3 w-3 shrink-0" />
                {person.email}
              </p>
            )}
            {showAvailability && person.availabilityStatus && (
              <AvailabilityBadge availability={person.availabilityStatus} size="xs" className="mt-1.5" />
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-ink-200 p-3 text-sm text-ink-400">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

/** Ticket metadata panel - a collapsible section on mobile (spec §64). */
export function TicketSidebar({ ticket, role, history, className }) {
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const isStaff = role === ROLES.AGENT || role === ROLES.ADMIN;

  return (
    <aside className={cn('card overflow-hidden p-0', className)}>
      <button
        type="button"
        onClick={() => setOpenOnMobile((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left lg:cursor-default"
      >
        <span className="text-sm font-bold text-ink-900">Ticket details</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-ink-400 transition lg:hidden',
            openOnMobile && 'rotate-180',
          )}
        />
      </button>

      <div className={cn('px-5 pb-5', !openOnMobile && 'hidden lg:block')}>
        <div className="space-y-4">
          <PersonBlock
            title="Customer"
            person={ticket.createdBy}
            icon={User2}
            emptyLabel="Unknown"
          />

          <PersonBlock
            title="Assigned agent"
            person={ticket.assignedTo}
            icon={User2}
            showAvailability
            emptyLabel="Waiting for an available agent"
          />
        </div>

        <dl className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
          <Row label="Status">
            <StatusBadge status={ticket.status} />
          </Row>
          <Row label="Priority">
            <PriorityBadge priority={ticket.priority} />
          </Row>
          <Row label="Category">
            <span className="inline-flex items-center gap-1.5 text-ink-700">
              <Tag className="h-3.5 w-3.5 text-ink-400" />
              {ticket.category}
            </span>
          </Row>
          <Row label="Created">{formatDateTime(ticket.createdAt)}</Row>
          {ticket.assignedAt && <Row label="Assigned">{formatRelative(ticket.assignedAt)}</Row>}
          {ticket.resolvedAt && <Row label="Resolved">{formatRelative(ticket.resolvedAt)}</Row>}
          {ticket.closedAt && <Row label="Closed">{formatRelative(ticket.closedAt)}</Row>}
          {ticket.reopenCount > 0 && <Row label="Reopened">{ticket.reopenCount}x</Row>}
        </dl>

        {isStaff && history?.length > 0 && (
          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <History className="h-3.5 w-3.5" />
              Assignment history
            </p>
            <ol className="space-y-3">
              {history.map((entry) => (
                <li key={entry._id} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink-700">
                      {entry.newAgent ? (
                        <>
                          Assigned to{' '}
                          <span className="font-semibold text-ink-900">{entry.newAgent.name}</span>
                        </>
                      ) : (
                        'Queued - no agent available'
                      )}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {entry.assignedByType === 'ADMIN'
                        ? `Override by ${entry.assignedBy?.name ?? 'admin'}`
                        : entry.reason.replaceAll('_', ' ').toLowerCase()}
                      {' · '}
                      {formatRelative(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </aside>
  );
}

export default TicketSidebar;
