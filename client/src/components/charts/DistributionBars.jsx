import cn from '../../utils/cn.js';
import { EmptyState } from '../common/States.jsx';

/**
 * Labelled horizontal bars for status / priority breakdowns.
 *
 * The row label carries identity, so the colour is redundant reinforcement of
 * the same status colours used on badges elsewhere in the app - a reader never
 * has to decode a colour key. Values are printed directly on every row.
 */
export function DistributionBars({ items = [], className, emptyLabel = 'No tickets yet' }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return <EmptyState title={emptyLabel} className="py-10" />;
  }

  return (
    <ul className={cn('space-y-3.5', className)}>
      {items
        .filter((item) => item.value > 0 || item.alwaysShow)
        .map((item) => {
          const share = total ? (item.value / total) * 100 : 0;

          return (
            <li key={item.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-sm font-medium text-ink-600">{item.name}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-ink-900">
                  {item.value}
                  <span className="ml-1.5 text-xs font-medium text-ink-400">
                    {Math.round(share)}%
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(share, item.value > 0 ? 2 : 0)}%`, backgroundColor: item.color }}
                />
              </div>
            </li>
          );
        })}
    </ul>
  );
}

export default DistributionBars;
