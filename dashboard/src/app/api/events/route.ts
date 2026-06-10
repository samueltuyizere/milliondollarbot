import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBotOrSession } from "@/lib/bot-auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const denied = await verifyBotOrSession(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "2"), 1), 30);

    const now   = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const [newsEvents, holidays] = await Promise.all([
      prisma.newsEvent.findMany({
        where: { eventTime: { gte: now, lte: until } },
        orderBy: { eventTime: "asc" },
        take: 100,
      }),
      prisma.bankHoliday.findMany({
        where: {
          date: {
            gte: new Date(now.toISOString().slice(0, 10)),
            lte: new Date(until.toISOString().slice(0, 10) + "T23:59:59Z"),
          },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    return NextResponse.json({ newsEvents, holidays });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
