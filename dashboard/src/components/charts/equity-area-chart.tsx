"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/charts/trade-stats";
import { CHART_COLORS } from "@/lib/charts/trade-stats";
import { ChartPanel, EmptyChart } from "@/components/charts/chart-panel";

interface EquityAreaChartProps {
  data: EquityPoint[];
  loading?: boolean;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: EquityPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground">{point.label}</p>
      <p className="text-muted-foreground mt-1 tabular">
        Equity: <span className="text-foreground font-mono">{formatUsd(point.equity)}</span>
      </p>
      <p className="text-muted-foreground tabular">
        P&L:{" "}
        <span
          className={`font-mono ${point.pnl >= 0 ? "text-[--profit]" : "text-[--loss]"}`}
        >
          {point.pnl >= 0 ? "+" : ""}
          {formatUsd(point.pnl)}
        </span>
      </p>
    </div>
  );
}

export function EquityAreaChart({ data, loading }: EquityAreaChartProps) {
  const hasTrend = data.length > 1;

  return (
    <ChartPanel
      title="Equity curve"
      subtitle="Cumulative balance from closed trades"
    >
      {loading ? (
        <EmptyChart>Loading chart…</EmptyChart>
      ) : !hasTrend ? (
        <EmptyChart>
          Equity history will appear after trades close.
        </EmptyChart>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.gold} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="oklch(1 0 0 / 6%)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "oklch(0.60 0.01 260)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "oklch(0.60 0.01 260)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v) =>
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
              domain={["auto", "auto"]}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={CHART_COLORS.gold}
              strokeWidth={2}
              fill="url(#equityFill)"
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.gold, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
}
