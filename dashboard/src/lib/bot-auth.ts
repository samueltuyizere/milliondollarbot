import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BOT_SECRET = process.env.BOT_SECRET;

/**
 * Accept either the Python bot (X-Bot-Secret header) or an authenticated
 * browser session. Use this for endpoints the bot AND the UI both read.
 * Returns null when authorised, or a 401 NextResponse when not.
 */
export async function verifyBotOrSession(
  req: Request
): Promise<NextResponse | null> {
  const secret = req.headers.get("x-bot-secret");
  if (BOT_SECRET && secret === BOT_SECRET) return null;

  const session = await auth();
  if (session?.user) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Accept ONLY the Python bot (X-Bot-Secret header).
 * Use this for write endpoints the browser should never call directly.
 * Returns null when authorised, or a 401 NextResponse when not.
 */
export async function verifyBotSecret(
  req: Request
): Promise<NextResponse | null> {
  const secret = req.headers.get("x-bot-secret");
  if (BOT_SECRET && secret === BOT_SECRET) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
