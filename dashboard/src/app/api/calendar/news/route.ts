import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const events = await prisma.newsEvent.findMany({ orderBy: { eventTime: "asc" } });
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = await prisma.newsEvent.create({
      data: {
        title: body.title,
        currency: body.currency ?? "USD",
        impact: body.impact ?? "HIGH",
        eventTime: new Date(body.eventTime),
        skipTrading: body.skipTrading ?? true,
        minutesBefore: body.minutesBefore ?? 30,
        minutesAfter: body.minutesAfter ?? 30,
      },
    });
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
