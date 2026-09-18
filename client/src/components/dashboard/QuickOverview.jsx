import cn from '../../utils/cn.js';

/**
 * The pastel gradient hero strip at the top of each dashboard.
 * Holds the handful of numbers that describe the whole desk at a glance.
 */
export function QuickOverview({ title, subtitle, items = [], className }) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-panel border border-white/70 bg-hero p-5 shadow-card sm:p-6',
        className,
      )}
    >
      {/* Soft light bloom, purely decorative. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/45 blur-2xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-white/35 blur-2xl"
      />

      <div className="relative">
        <h2 className="text-lg font-extrabold tracking-tight text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/80 bg-white/65 px-4 py-3.5 backdrop-blur-sm"
            >
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tabular-nums leading-none text-ink-900">
                  {item.value}
                </span>
                {item.delta != null && (
                  <span className="text-[11px] font-semibold text-ink-500">({item.delta})</span>
                )}
              </p>
              <p className="mt-1.5 truncate text-sm font-semibold text-ink-600">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default QuickOverview;
