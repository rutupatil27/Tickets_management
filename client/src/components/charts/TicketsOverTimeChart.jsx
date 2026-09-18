import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartColors, chartInk } from '../../theme/tokens.js';
import ChartTooltip from './ChartTooltip.jsx';
import { EmptyState } from '../common/States.jsx';

/**
 * Ticket volume over the last N months.
 *
 * Two series on ONE axis (never a second y-scale): tickets created and how many
 * of them ended up resolved or closed. Bars carry 4px rounded data-ends and a
 * 2px surface gap so neighbouring bars stay separable.
 */
export function TicketsOverTimeChart({ data = [], height = 280 }) {
  const hasData = data.some((point) => point.total > 0);

  if (!hasData) {
    return (
      <EmptyState
        title="No ticket history yet"
        description="Once tickets start flowing this chart shows monthly volume."
        className="py-10"
      />
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={chartInk.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: chartInk.axis }}
            tick={{ fill: chartInk.tick, fontSize: 12 }}
            dy={4}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: chartInk.tick, fontSize: 12 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: chartInk.label }}
          />
          <Bar
            dataKey="total"
            name="Created"
            fill={chartColors[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
          <Bar
            dataKey="resolved"
            name="Resolved"
            fill={chartColors[2]}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TicketsOverTimeChart;
