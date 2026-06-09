import type { TradeRow } from "@/types";

export interface EquityPoint {
  label: string;
  equity: number;
  pnl: number;
}

export interface OutcomeSlice {
  name: string;
  value: number;
  color: string;
}

export const CHART_COLORS = {
  profit: "oklch(0.72 0.17 145)",
  loss: "oklch(0.65 0.21 25)",
  breakeven: "oklch(0.78 0.16 75)",
  open: "oklch(0.55 0.01 260)",
  gold: "oklch(0.78 0.16 75)",
} as const;

export function buildEquitySeries(
  trades: TradeRow[],
  startingBalance: number,
  currentEquity?: number | null
): EquityPoint[] {
  const closed = trades
    .filter((t) => t.closeTime && t.pnl != null)
    .sort(
      (a, b) =>
        new Date(a.closeTime!).getTime() - new Date(b.closeTime!).getTime()
    );

  let cumulative = 0;
  const points: EquityPoint[] = [
    { label: "Start", equity: startingBalance, pnl: 0 },
  ];

  for (const trade of closed) {
    cumulative += trade.pnl ?? 0;
    const d = new Date(trade.closeTime!);
    points.push({
      label: d.toLocaleDateString([], { month: "short", day: "numeric" }),
      equity: startingBalance + cumulative,
      pnl: cumulative,
    });
  }

  if (currentEquity != null && currentEquity > 0) {
    const last = points[points.length - 1];
    if (!last || Math.abs(last.equity - currentEquity) > 0.5) {
      points.push({
        label: "Now",
        equity: currentEquity,
        pnl: currentEquity - startingBalance,
      });
    }
  }

  return points;
}

export function buildOutcomeBreakdown(trades: TradeRow[]): OutcomeSlice[] {
  const counts = {
    Wins: trades.filter((t) => t.status === "CLOSED_WIN").length,
    Losses: trades.filter((t) => t.status === "CLOSED_LOSS").length,
    "Break-even": trades.filter((t) => t.status === "CLOSED_BE").length,
    Open: trades.filter((t) => t.status === "OPEN").length,
  };

  const colors: Record<string, string> = {
    Wins: CHART_COLORS.gold,
    Losses: CHART_COLORS.loss,
    "Break-even": CHART_COLORS.open,
    Open: "oklch(0.55 0.06 260)",
  };

  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: colors[name],
    }));
}

export function calcWinRate(trades: TradeRow[]): number | null {
  const closed = trades.filter((t) =>
    ["CLOSED_WIN", "CLOSED_LOSS", "CLOSED_BE"].includes(t.status)
  );
  if (closed.length === 0) return null;
  const wins = closed.filter((t) => t.status === "CLOSED_WIN").length;
  return (wins / closed.length) * 100;
}
