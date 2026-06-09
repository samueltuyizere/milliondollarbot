import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const status = await prisma.botStatus.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!status) {
      return NextResponse.json({
        status: {
          status: "STOPPED", lastPing: null, equity: null, balance: null,
          dailyPnl: 0, drawdownPct: 0, openTrades: 0, errorMsg: null, botMode: null,
        },
      });
    }
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
