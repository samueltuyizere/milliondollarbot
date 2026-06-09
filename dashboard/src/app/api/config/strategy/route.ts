import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const strategy = await prisma.strategyConfig.findFirst();
    return NextResponse.json({ strategy });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const existing = await prisma.strategyConfig.findFirst();

    if (!existing) {
      return NextResponse.json({ error: "No strategy config found." }, { status: 404 });
    }

    const old = { ...existing };
    const updated = await prisma.strategyConfig.update({
      where: { id: existing.id },
      data: {
        emaFast: body.emaFast,
        emaSlow: body.emaSlow,
        rsiPeriod: body.rsiPeriod,
        rsiOversold: body.rsiOversold,
        atrPeriod: body.atrPeriod,
        atrMultiSl: body.atrMultiSl,
      },
    });

    await logAudit({
      action: "config.strategy.update",
      resource: "strategy_configs",
      oldValue: old,
      newValue: updated,
    });

    return NextResponse.json({ ok: true, strategy: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
