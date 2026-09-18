import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { chartColors, chartInk } from '../../theme/tokens.js';
import ChartTooltip from './ChartTooltip.jsx';
import { EmptyState } from '../common/States.jsx';

/**
 * Donut for part-of-whole breakdowns (tickets by category / by priority).
 *
 * Identity is never colour-alone: the legend beside the ring names every slice
 * and prints its value and share. Segments are separated by a 2px surface-
 * coloured stroke so adjacent arcs stay distinct.
 */
export function DonutChart({ data, centerLabel = 'Total', height = 260, maxSlices = 8 }) {
  const { slices, total } = useMemo(() => {
    const cleaned = (data ?? []).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);

    // Never invent a 9th hue - anything past the palette folds into "Other".
    const head = cleaned.slice(0, maxSlices - 1);
    const tail = cleaned.slice(maxSlices - 1);

    const merged =
      tail.length > 1
        ? [...head, { name: 'Other', value: tail.reduce((sum, item) => sum + item.value, 0) }]
        : cleaned.slice(0, maxSlices);

    return {
      slices: merged.map((item, index) => ({ ...item, fill: chartColors[index % chartColors.length] })),
      total: cleaned.reduce((sum, item) => sum + item.value, 0),
    };
  }, [data, maxSlices]);

  if (!total) {
    return <EmptyState title="No data yet" description="Charts populate as tickets come in." className="py-10" />;
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="63%"
              outerRadius="100%"
              paddingAngle={2}
              stroke={chartInk.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip total={total} />} cursor={false} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="block text-2xl font-extrabold tabular-nums text-ink-900">{total}</span>
          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className="grid w-full flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: slice.fill }}
            />
            <span className="truncate text-ink-600">{slice.name}</span>
            <span className="ml-auto shrink-0 font-bold tabular-nums text-ink-900">
              {slice.value}
              <span className="ml-1 text-xs font-medium text-ink-400">
                {Math.round((slice.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DonutChart;
