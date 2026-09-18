import { Search, SlidersHorizontal, X } from 'lucide-react';
import cn from '../../utils/cn.js';
import Button from '../common/Button.jsx';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
} from '../../utils/constants.js';

const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Highest priority' },
];

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10 sm:w-auto"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Every control here maps to a backend query parameter - the server does the
 * filtering, the client only collects intent (spec §69).
 */
export function TicketFilters({ filters, onChange, onReset, extra, className }) {
  const hasActiveFilters = Boolean(
    filters.search || filters.status || filters.priority || filters.category || filters.agentId,
  );

  return (
    <div className={cn('flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={filters.search ?? ''}
            onChange={(event) => onChange({ search: event.target.value, page: 1 })}
            placeholder="Search ticket ID or subject..."
            aria-label="Search tickets"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-3 text-sm text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Status"
            allLabel="All statuses"
            value={filters.status ?? ''}
            onChange={(value) => onChange({ status: value, page: 1 })}
            options={TICKET_STATUS_VALUES.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
            }))}
          />
          <FilterSelect
            label="Priority"
            allLabel="All priorities"
            value={filters.priority ?? ''}
            onChange={(value) => onChange({ priority: value, page: 1 })}
            options={TICKET_PRIORITY_VALUES.map((priority) => ({
              value: priority,
              label: PRIORITY_LABELS[priority],
            }))}
          />
          <FilterSelect
            label="Category"
            allLabel="All categories"
            value={filters.category ?? ''}
            onChange={(value) => onChange({ category: value, page: 1 })}
            options={TICKET_CATEGORIES.map((category) => ({ value: category, label: category }))}
          />

          {extra}

          <FilterSelect
            label="Sort"
            allLabel="Recently updated"
            value={filters.sort ?? 'updated'}
            onChange={(value) => onChange({ sort: value || 'updated', page: 1 })}
            options={SORT_OPTIONS}
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" icon={X} onClick={onReset}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <p className="flex items-center gap-1.5 text-xs text-ink-400">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters are applied on the server, so results stay accurate across pages.
        </p>
      )}
    </div>
  );
}

export default TicketFilters;
