import { ChevronLeft, ChevronRight } from 'lucide-react';
import cn from '../../utils/cn.js';

/** Windowed page numbers with ellipses, e.g. 1 ... 4 5 6 ... 13 */
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('...');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push('...');
  pages.push(total);

  return pages;
}

export function Pagination({ pagination, onPageChange, className }) {
  if (!pagination || pagination.total === 0) return null;

  const { page, limit, total, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row sm:px-5',
        className,
      )}
    >
      <p className="text-xs text-ink-500">
        Showing <span className="font-semibold text-ink-700">{from}</span>-
        <span className="font-semibold text-ink-700">{to}</span> of{' '}
        <span className="font-semibold text-ink-700">{total}</span>
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageWindow(page, totalPages).map((entry, index) =>
            entry === '...' ? (
              <span key={`gap-${index}`} className="px-1.5 text-xs text-ink-400">
                ...
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition',
                  entry === page
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-600 hover:bg-ink-100',
                )}
              >
                {entry}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

export default Pagination;
