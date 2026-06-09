import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const level = searchParams.get("level");

  try {
    const logs = await prisma.systemLog.findMany({
      where: level ? { level: level as "INFO" } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ logs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const log = await prisma.systemLog.create({
      data: {
        level: body.level,
        source: body.source,
        message: body.message,
        metadata: body.metadata,
      },
    });
    return NextResponse.json({ ok: true, log });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
