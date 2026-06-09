import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const holidays = await prisma.bankHoliday.findMany({ orderBy: { date: "asc" } });
    return NextResponse.json({ holidays });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const holiday = await prisma.bankHoliday.create({
      data: {
        country: body.country,
        name: body.name,
        date: new Date(body.date),
        description: body.description,
      },
    });
    return NextResponse.json({ ok: true, holiday });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
