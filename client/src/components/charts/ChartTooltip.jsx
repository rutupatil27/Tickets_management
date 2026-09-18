/**
 * Shared Recharts tooltip.
 * Text always wears ink tokens; the series colour appears only as a small swatch
 * beside the label, never as the text colour itself.
 */
export function ChartTooltip({ active, payload, label, valueSuffix = '', total }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3 py-2.5 shadow-pop">
      {label != null && (
        <p className="mb-1.5 text-xs font-bold text-ink-900">{label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry) => {
          const value = entry.value ?? 0;
          const share = total ? Math.round((value / total) * 100) : null;

          return (
            <li key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: entry.color ?? entry.payload?.fill }}
              />
              <span className="text-ink-500">{entry.name}</span>
              <span className="ml-auto font-bold tabular-nums text-ink-900">
                {value}
                {valueSuffix}
                {share != null && <span className="ml-1 font-medium text-ink-400">({share}%)</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ChartTooltip;
