import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const status = searchParams.get("status");

  try {
    const trades = await prisma.trade.findMany({
      where: status ? { status: status as "OPEN" } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ trades });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Called by Python bot to record a new trade
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const trade = await prisma.trade.create({
      data: {
        accountId: body.accountId,
        symbol: body.symbol ?? "XAUUSD",
        direction: body.direction,
        entryPrice: body.entryPrice,
        stopLoss: body.stopLoss,
        takeProfit: body.takeProfit,
        lotSize: body.lotSize,
        mt5Ticket: body.mt5Ticket,
        status: "OPEN",
      },
    });

    await prisma.tradeLog.create({
      data: {
        tradeId: trade.id,
        event: "OPENED",
        message: `${body.direction} ${body.symbol} @ ${body.entryPrice} | SL:${body.stopLoss} TP:${body.takeProfit} Lots:${body.lotSize}`,
      },
    });

    return NextResponse.json({ ok: true, trade });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
