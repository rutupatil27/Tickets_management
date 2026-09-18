import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox, Ticket as TicketIcon } from 'lucide-react';
import Card from '../common/Card.jsx';
import Pagination from '../common/Pagination.jsx';
import { EmptyState, ErrorState, TableSkeleton } from '../common/States.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import TicketFilters from './TicketFilters.jsx';
import TicketTable from './TicketTable.jsx';
import useTickets from '../../hooks/useTickets.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLE_BASE_PATH } from '../../utils/constants.js';

/**
 * The ticket list screen, shared by all three roles.
 *
 * Scope is decided by the backend from the caller's role, so the same component
 * safely renders "my tickets", "my queue" and "all tickets" (spec §92.5).
 */
export function TicketListView({ title, subtitle, actions, emptyState, extraFilters, baseQuery }) {
  const { user } = useAuth();
  const basePath = ROLE_BASE_PATH[user.role];

  // URL is the source of truth for filters, so a filtered list is shareable
  // and survives a refresh or a back-navigation from a ticket.
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(searchDraft, 400);

  const filters = useMemo(() => {
    const fromUrl = Object.fromEntries(searchParams.entries());
    return {
      page: Number(fromUrl.page) || 1,
      limit: 10,
      sort: fromUrl.sort || 'updated',
      status: searchParams.getAll('status').length ? searchParams.getAll('status') : undefined,
      priority: fromUrl.priority || undefined,
      category: fromUrl.category || undefined,
      agentId: fromUrl.agentId || undefined,
      customerId: fromUrl.customerId || undefined,
      unassigned: fromUrl.unassigned || undefined,
      search: debouncedSearch || undefined,
      ...baseQuery,
    };
  }, [searchParams, debouncedSearch, baseQuery]);

  const { tickets, pagination, loading, error, reload } = useTickets(filters);

  const updateFilters = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);

      Object.entries(patch).forEach(([key, value]) => {
        if (key === 'search') {
          setSearchDraft(value);
          if (value) next.set('search', value);
          else next.delete('search');
          return;
        }
        if (value === undefined || value === null || value === '') next.delete(key);
        else next.set(key, value);
      });

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchDraft('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const uiFilters = {
    search: searchDraft,
    status: searchParams.getAll('status')[0] ?? '',
    priority: searchParams.get('priority') ?? '',
    category: searchParams.get('category') ?? '',
    agentId: searchParams.get('agentId') ?? '',
    sort: searchParams.get('sort') ?? 'updated',
  };

  const isFiltered = Boolean(
    uiFilters.search || uiFilters.status || uiFilters.priority || uiFilters.category || uiFilters.agentId,
  );

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={subtitle} actions={actions} />

      <Card padded={false} className="overflow-hidden">
        <TicketFilters
          filters={uiFilters}
          onChange={updateFilters}
          onReset={resetFilters}
          extra={extraFilters}
        />

        {loading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : tickets.length === 0 ? (
          isFiltered ? (
            <EmptyState
              icon={Inbox}
              title="No tickets match these filters"
              description="Try clearing the search or choosing a different status."
            />
          ) : (
            emptyState ?? (
              <EmptyState
                icon={TicketIcon}
                title="No tickets yet"
                description="Tickets will appear here as soon as they are created."
              />
            )
          )
        ) : (
          <>
            <TicketTable tickets={tickets} role={user.role} basePath={basePath} />
            <Pagination
              pagination={pagination}
              onPageChange={(page) => updateFilters({ page: String(page) })}
            />
          </>
        )}
      </Card>
    </div>
  );
}

export default TicketListView;
