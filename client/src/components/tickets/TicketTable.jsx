import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import cn from '../../utils/cn.js';
import Avatar from '../common/Avatar.jsx';
import { CategoryBadge, PriorityBadge, StatusBadge } from '../common/Badge.jsx';
import { formatSmart, truncate } from '../../utils/format.js';
import { ROLES } from '../../utils/constants.js';

function PersonCell({ person, fallback = 'Unassigned' }) {
  if (!person) {
    return <span className="text-sm text-ink-400">{fallback}</span>;
  }

  return (
    <span className="flex items-center gap-2">
      <Avatar name={person.name} src={person.avatar} size="xs" ring={false} />
      <span className="truncate text-sm font-medium text-ink-700">{person.name}</span>
    </span>
  );
}

/**
 * Ticket list. Renders a real table on desktop and stacked cards on mobile so
 * the conversation-first columns stay readable on a phone (spec §64).
 */
export function TicketTable({ tickets, role, basePath }) {
  const showCustomer = role === ROLES.AGENT || role === ROLES.ADMIN;
  const showAgent = role === ROLES.CUSTOMER || role === ROLES.ADMIN;

  return (
    <>
      {/* ------------------------------------------------------- desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-100 bg-surface-muted/60">
              <th scope="col" className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                Ticket
              </th>
              {showCustomer && (
                <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                  Customer
                </th>
              )}
              {showAgent && (
                <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                  Agent
                </th>
              )}
              <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                Category
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                Priority
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-ink-400">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {tickets.map((ticket) => (
              <tr key={ticket._id} className="group transition hover:bg-brand-50/40">
                <td className="px-5 py-3.5">
                  <Link to={`${basePath}/tickets/${ticket._id}`} className="block">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-600">
                        {ticket.ticketNumber}
                      </span>
                      {ticket.unreadCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {ticket.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block max-w-[26rem] truncate text-sm font-semibold text-ink-800 group-hover:text-brand-700">
                      {ticket.subject}
                    </span>
                  </Link>
                </td>
                {showCustomer && (
                  <td className="max-w-[10rem] px-4 py-3.5">
                    <PersonCell person={ticket.createdBy} />
                  </td>
                )}
                {showAgent && (
                  <td className="max-w-[10rem] px-4 py-3.5">
                    <PersonCell person={ticket.assignedTo} />
                  </td>
                )}
                <td className="px-4 py-3.5">
                  <CategoryBadge category={ticket.category} />
                </td>
                <td className="px-4 py-3.5">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs text-ink-500">
                  {formatSmart(ticket.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* -------------------------------------------------------- mobile */}
      <ul className="divide-y divide-ink-100 md:hidden">
        {tickets.map((ticket) => (
          <li key={ticket._id}>
            <Link to={`${basePath}/tickets/${ticket._id}`} className="block p-4 transition active:bg-ink-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-brand-600">
                  {ticket.ticketNumber}
                </span>
                <span className="text-[11px] text-ink-400">{formatSmart(ticket.updatedAt)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-800">
                {truncate(ticket.subject, 70)}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={ticket.status} size="xs" />
                <PriorityBadge priority={ticket.priority} size="xs" />
                <CategoryBadge category={ticket.category} />
                {ticket.unreadCount > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5',
                      'text-[10px] font-bold text-brand-700',
                    )}
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    {ticket.unreadCount} new
                  </span>
                )}
              </div>
              {(showCustomer || showAgent) && (
                <div className="mt-2.5 flex items-center gap-4">
                  {showCustomer && ticket.createdBy && (
                    <PersonCell person={ticket.createdBy} />
                  )}
                  {showAgent && <PersonCell person={ticket.assignedTo} />}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default TicketTable;
