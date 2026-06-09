import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(PERMISSIONS.ROLES_VIEW);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const role = await prisma.role.findUnique({
    where: { id },
    include: { permissions: { orderBy: [{ category: "asc" }, { code: "asc" }] }, _count: { select: { users: true } } },
  });

  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  return NextResponse.json(role);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const body = await req.json();
  const { description, permissionIds } = body as {
    description?: string;
    permissionIds?: string[];
  };

  const updated = await prisma.role.update({
    where: { id },
    data: {
      description: description?.trim() ?? role.description,
      permissions: permissionIds !== undefined
        ? { set: permissionIds.map((pid) => ({ id: pid })) }
        : undefined,
    },
    include: { permissions: true, _count: { select: { users: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  if (role.isSystem) {
    return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 400 });
  }
  if (role._count.users > 0) {
    return NextResponse.json(
      { error: `Cannot delete role — ${role._count.users} user(s) are assigned to it` },
      { status: 400 }
    );
  }

  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
