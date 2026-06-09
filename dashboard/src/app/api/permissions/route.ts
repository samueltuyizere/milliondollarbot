import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const session = await requirePermission(PERMISSIONS.ROLES_VIEW);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const permissions = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  return NextResponse.json(permissions);
}
