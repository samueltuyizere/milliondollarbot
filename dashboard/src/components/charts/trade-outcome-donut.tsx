"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OutcomeSlice } from "@/lib/charts/trade-stats";
import { calcWinRate } from "@/lib/charts/trade-stats";
import type { TradeRow } from "@/types";
import { ChartPanel, EmptyChart } from "@/components/charts/chart-panel";

interface TradeOutcomeDonutProps {
  slices: OutcomeSlice[];
  trades: TradeRow[];
  loading?: boolean;
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: OutcomeSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="text-muted-foreground mt-0.5 tabular">
        {item.value} trade{item.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function DonutCenter({ winRate, total }: { winRate: number | null; total: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <span className="text-2xl font-semibold tabular text-foreground">
        {winRate != null ? `${winRate.toFixed(0)}%` : "—"}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
        {winRate != null ? "Win rate" : "No closed"}
      </span>
      <span className="text-[10px] text-muted-foreground/70 mt-1 tabular">
        {total} total
      </span>
    </div>
  );
}

export function TradeOutcomeDonut({ slices, trades, loading }: TradeOutcomeDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const winRate = calcWinRate(trades);

  return (
    <ChartPanel title="Trade outcomes" subtitle="Wins, losses & open positions">
      {loading ? (
        <EmptyChart>Loading chart…</EmptyChart>
      ) : total === 0 ? (
        <EmptyChart>No trades to chart yet.</EmptyChart>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="transparent"
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <DonutCenter winRate={winRate} total={total} />
          </div>

          {/* Legend — centered at bottom */}
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 pb-1">
            {slices.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </ChartPanel>
  );
}
