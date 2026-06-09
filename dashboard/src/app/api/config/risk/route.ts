import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const risk = await prisma.riskRules.findFirst({
      include: { botConfig: { select: { accountId: true } } },
    });
    return NextResponse.json({ risk });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string })?.id;
    const body = await req.json();
    const existing = await prisma.riskRules.findFirst();

    if (!existing) {
      return NextResponse.json({ error: "No bot config found. Set up account first." }, { status: 404 });
    }

    const old = { ...existing };
    const updated = await prisma.riskRules.update({
      where: { id: existing.id },
      data: {
        riskPerTradePct: body.riskPerTradePct,
        maxDailyLossPct: body.maxDailyLossPct,
        maxDrawdownPct: body.maxDrawdownPct,
        minRR: body.minRR,
        maxOpenTrades: body.maxOpenTrades,
      },
    });

    await logAudit({
      userId,
      action: "config.risk.update",
      resource: "risk_rules",
      oldValue: old,
      newValue: updated,
    });

    return NextResponse.json({ ok: true, risk: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
