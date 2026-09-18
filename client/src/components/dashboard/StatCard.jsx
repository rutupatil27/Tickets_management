import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import cn from '../../utils/cn.js';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  info: 'bg-info-50 text-info-600',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
  neutral: 'bg-ink-100 text-ink-600',
};

/**
 * A single headline number. Deliberately not a chart - one value with a label
 * reads faster than any plot of it.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  to,
  className,
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-extrabold tabular-nums leading-none text-ink-900">{value}</p>
          <p className="mt-2 truncate text-sm font-semibold text-ink-600">{label}</p>
        </div>
        {Icon && (
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', TONES[tone])}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-ink-400">{hint}</p>
        {to && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500 transition group-hover:bg-brand-600 group-hover:text-white">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  );

  const classes = cn('card group block p-4 transition', to && 'hover:border-brand-200', className);

  return to ? (
    <Link to={to} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

export default StatCard;
