export type BotState = "RUNNING" | "PAUSED" | "STOPPED" | "ERROR" | "DAILY_LOCK";
export type TradeDirection = "BUY" | "SELL";
export type TradeStatus = "PENDING" | "OPEN" | "CLOSED_WIN" | "CLOSED_LOSS" | "CLOSED_BE" | "CANCELLED";
export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type BotMode = "mock" | "live";

export interface DashboardStats {
  status: BotState;
  equity: number;
  balance: number;
  dailyPnl: number;
  drawdownPct: number;
  openTrades: number;
  lastPing: string | null;
  errorMsg: string | null;
  botMode?: BotMode | null;
}

export interface TradeRow {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  status: TradeStatus;
  openTime: string;
  closeTime?: string | null;
  closePrice?: number | null;
  pnl?: number | null;
  manualClose?: boolean;
}

export interface RiskConfig {
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
  minRR: number;
  maxOpenTrades: number;
  dailyLockActive: boolean;
}

export interface StrategyConfigData {
  emaFast: number;
  emaSlow: number;
  rsiPeriod: number;
  rsiOversold: number;
  atrPeriod: number;
  atrMultiSl: number;
  timeframe: string;
}

export interface BotConfigData {
  symbol: string;
  isRunning: boolean;
  isPaused: boolean;
  longOnly: boolean;
  sessionStart: string;
  sessionEnd: string;
}
