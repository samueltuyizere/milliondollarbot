import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBotSecret } from "@/lib/bot-auth";

// POST /api/bot/heartbeat — called by the Python bot every N seconds
export async function POST(req: Request) {
  const denied = await verifyBotSecret(req);
  if (denied) return denied;
  try {
    const body = await req.json() as {
      status?: string;
      equity?: number;
      balance?: number;
      dailyPnl?: number;
      peakEquity?: number;
      drawdownPct?: number;
      openTrades?: number;
      errorMsg?: string | null;
      botMode?: "mock" | "live";
    };

    const existing = await prisma.botStatus.findFirst({ orderBy: { updatedAt: "desc" } });

    // Always derive openTrades from the real DB count so the dashboard
    // stays accurate even if the bot's in-memory count drifts.
    const dbOpenCount = await prisma.trade.count({ where: { status: "OPEN" } });

    const data = {
      lastPing: new Date(),
      equity: body.equity,
      balance: body.balance,
      dailyPnl: body.dailyPnl ?? 0,
      peakEquity: body.peakEquity,
      drawdownPct: body.drawdownPct ?? 0,
      openTrades: dbOpenCount,
      errorMsg: body.errorMsg ?? null,
      ...(body.botMode && { botMode: body.botMode }),
      ...(body.status && { status: body.status as "RUNNING" | "PAUSED" | "STOPPED" | "ERROR" | "DAILY_LOCK" }),
    };

    if (existing) {
      await prisma.botStatus.update({ where: { id: existing.id }, data });
    } else {
      await prisma.botStatus.create({ data: { ...data, status: (body.status ?? "RUNNING") as "RUNNING" } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
