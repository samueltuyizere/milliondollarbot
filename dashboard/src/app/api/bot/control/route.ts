import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, logSystem } from "@/lib/audit";

type Command = "start" | "stop" | "pause" | "resume";

export async function POST(req: Request) {
  try {
    const { command } = (await req.json()) as { command: Command };
    if (!["start", "stop", "pause", "resume"].includes(command)) {
      return NextResponse.json({ error: "Invalid command" }, { status: 400 });
    }

    const current = await prisma.botStatus.findFirst({ orderBy: { updatedAt: "desc" } });

    if (current?.status === "DAILY_LOCK" && command !== "start") {
      return NextResponse.json({ error: "Bot is in daily loss lock. Only manual Start allowed." }, { status: 409 });
    }

    const statusMap: Record<Command, string> = {
      start: "RUNNING",
      stop: "STOPPED",
      pause: "PAUSED",
      resume: "RUNNING",
    };

    const newStatus = statusMap[command];

    if (current) {
      await prisma.botStatus.update({
        where: { id: current.id },
        data: { status: newStatus as "RUNNING" | "PAUSED" | "STOPPED" | "ERROR" | "DAILY_LOCK", errorMsg: null },
      });
    } else {
      await prisma.botStatus.create({
        data: { status: newStatus as "RUNNING" | "PAUSED" | "STOPPED" | "ERROR" | "DAILY_LOCK" },
      });
    }

    await logAudit({ action: `bot.${command}`, resource: "bot_status" });
    await logSystem({ level: "INFO", source: "api", message: `Bot command: ${command} → ${newStatus}` });

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
