import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const config = await prisma.botConfig.findFirst();
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string })?.id;
    const body = await req.json();
    const existing = await prisma.botConfig.findFirst();

    if (!existing) {
      return NextResponse.json({ error: "No bot config found." }, { status: 404 });
    }

    const old = { ...existing };
    const updated = await prisma.botConfig.update({
      where: { id: existing.id },
      data: {
        longOnly: body.longOnly,
        sessionStart: body.sessionStart,
        sessionEnd: body.sessionEnd,
      },
    });

    await logAudit({
      userId,
      action: "config.bot.update",
      resource: "bot_configs",
      oldValue: old,
      newValue: updated,
    });

    return NextResponse.json({ ok: true, config: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
