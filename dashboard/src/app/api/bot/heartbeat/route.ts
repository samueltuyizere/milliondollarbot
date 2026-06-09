import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/bot/heartbeat — called by the Python bot every N seconds
export async function POST(req: Request) {
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
    };

    const existing = await prisma.botStatus.findFirst({ orderBy: { updatedAt: "desc" } });

    const data = {
      lastPing: new Date(),
      equity: body.equity,
      balance: body.balance,
      dailyPnl: body.dailyPnl ?? 0,
      peakEquity: body.peakEquity,
      drawdownPct: body.drawdownPct ?? 0,
      openTrades: body.openTrades ?? 0,
      errorMsg: body.errorMsg ?? null,
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
