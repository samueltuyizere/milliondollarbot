-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRADER');

-- CreateEnum
CREATE TYPE "BotState" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED', 'ERROR', 'DAILY_LOCK');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'OPEN', 'CLOSED_WIN', 'CLOSED_LOSS', 'CLOSED_BE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NewsImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRADER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "broker" TEXT NOT NULL DEFAULT 'FundedNext',
    "account_number" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "drawdown_limit" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "daily_loss_limit" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "phase" TEXT NOT NULL DEFAULT 'Phase 1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_configs" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT 'XAUUSD',
    "is_running" BOOLEAN NOT NULL DEFAULT false,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "long_only" BOOLEAN NOT NULL DEFAULT true,
    "session_start" TEXT NOT NULL DEFAULT '08:00',
    "session_end" TEXT NOT NULL DEFAULT '17:00',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_status" (
    "id" TEXT NOT NULL,
    "status" "BotState" NOT NULL DEFAULT 'STOPPED',
    "last_ping" TIMESTAMP(3),
    "equity" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "daily_pnl" DOUBLE PRECISION DEFAULT 0,
    "peak_equity" DOUBLE PRECISION,
    "drawdown_pct" DOUBLE PRECISION DEFAULT 0,
    "open_trades" INTEGER NOT NULL DEFAULT 0,
    "error_msg" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_configs" (
    "id" TEXT NOT NULL,
    "bot_config_id" TEXT NOT NULL,
    "ema_fast" INTEGER NOT NULL DEFAULT 21,
    "ema_slow" INTEGER NOT NULL DEFAULT 50,
    "rsi_period" INTEGER NOT NULL DEFAULT 14,
    "rsi_oversold" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "atr_period" INTEGER NOT NULL DEFAULT 14,
    "atr_multi_sl" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "timeframe" TEXT NOT NULL DEFAULT 'H1',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_rules" (
    "id" TEXT NOT NULL,
    "bot_config_id" TEXT NOT NULL,
    "risk_per_trade_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "max_daily_loss_pct" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "max_drawdown_pct" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "min_rr" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "max_open_trades" INTEGER NOT NULL DEFAULT 1,
    "daily_lock_active" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT 'XAUUSD',
    "direction" "Direction" NOT NULL,
    "entry_price" DOUBLE PRECISION NOT NULL,
    "stop_loss" DOUBLE PRECISION NOT NULL,
    "take_profit" DOUBLE PRECISION NOT NULL,
    "lot_size" DOUBLE PRECISION NOT NULL,
    "mt5_ticket" INTEGER,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "open_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "close_time" TIMESTAMP(3),
    "close_price" DOUBLE PRECISION,
    "pnl" DOUBLE PRECISION,
    "pnl_pct" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "swap" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_logs" (
    "id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "impact" "NewsImpact" NOT NULL DEFAULT 'HIGH',
    "event_time" TIMESTAMP(3) NOT NULL,
    "skip_trading" BOOLEAN NOT NULL DEFAULT true,
    "minutes_before" INTEGER NOT NULL DEFAULT 30,
    "minutes_after" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_holidays" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "bot_configs_account_id_key" ON "bot_configs"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_configs_bot_config_id_key" ON "strategy_configs"("bot_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_rules_bot_config_id_key" ON "risk_rules"("bot_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "trades_mt5_ticket_key" ON "trades"("mt5_ticket");

-- AddForeignKey
ALTER TABLE "bot_configs" ADD CONSTRAINT "bot_configs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_configs" ADD CONSTRAINT "strategy_configs_bot_config_id_fkey" FOREIGN KEY ("bot_config_id") REFERENCES "bot_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_rules" ADD CONSTRAINT "risk_rules_bot_config_id_fkey" FOREIGN KEY ("bot_config_id") REFERENCES "bot_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_logs" ADD CONSTRAINT "trade_logs_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
