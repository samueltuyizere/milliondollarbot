import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const pnl: number = body.pnl ?? 0;
    const status = pnl > 0 ? "CLOSED_WIN" : pnl < 0 ? "CLOSED_LOSS" : "CLOSED_BE";

    const trade = await prisma.trade.update({
      where: { id },
      data: {
        status,
        closePrice: body.closePrice,
        closeTime: new Date(),
        pnl,
        commission: body.commission,
        swap: body.swap,
      },
    });

    await prisma.tradeLog.create({
      data: {
        tradeId: id,
        event: "CLOSED",
        message: `Closed @ ${body.closePrice} | P&L: $${pnl.toFixed(2)} | ${status}`,
      },
    });

    return NextResponse.json({ ok: true, trade });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
