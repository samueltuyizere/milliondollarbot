import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by the UI to request a manual close on an open position.
// Sets manualClose=true — the bot picks this up on its next poll and closes it.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const trade = await prisma.trade.findUnique({ where: { id } });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    if (trade.status !== "OPEN") {
      return NextResponse.json(
        { error: "Trade is not open" },
        { status: 400 }
      );
    }

    await prisma.trade.update({
      where: { id },
      data: { manualClose: true },
    });

    await prisma.tradeLog.create({
      data: {
        tradeId: id,
        event: "MANUAL_CLOSE_REQUESTED",
        message: "Manual close requested from dashboard",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
