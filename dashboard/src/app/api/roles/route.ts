import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";

export async function GET() {
  const session = await requirePermission(PERMISSIONS.ROLES_VIEW);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const roles = await prisma.role.findMany({
    include: { permissions: { orderBy: [{ category: "asc" }, { code: "asc" }] }, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(roles);
}

export async function POST(req: NextRequest) {
  const session = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, permissionIds } = body as {
    name: string;
    description?: string;
    permissionIds?: string[];
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Role name is required" }, { status: 400 });
  }

  const existing = await prisma.role.findUnique({ where: { name: name.trim().toUpperCase() } });
  if (existing) {
    return NextResponse.json({ error: "A role with that name already exists" }, { status: 409 });
  }

  const role = await prisma.role.create({
    data: {
      name: name.trim().toUpperCase(),
      description: description?.trim() || null,
      permissions: permissionIds?.length
        ? { connect: permissionIds.map((id) => ({ id })) }
        : undefined,
    },
    include: { permissions: true, _count: { select: { users: true } } },
  });

  return NextResponse.json(role, { status: 201 });
}
