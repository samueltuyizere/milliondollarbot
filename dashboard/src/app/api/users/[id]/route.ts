import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(PERMISSIONS.USERS_VIEW);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: { include: { permissions: true } } },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    passwordChangeRequired: user.passwordChangeRequired,
    role: { id: user.role.id, name: user.role.name, permissions: user.role.permissions },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(PERMISSIONS.USERS_EDIT);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { name, email, roleId, isActive, password, passwordChangeRequired } = body as {
    name?: string;
    email?: string;
    roleId?: string;
    isActive?: boolean;
    password?: string;
    passwordChangeRequired?: boolean;
  };

  // Prevent deactivating self
  if (isActive === false) {
    const me = await auth();
    if (me?.user?.id === id) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim() || null;
  if (email !== undefined) updateData.email = email.trim().toLowerCase();
  if (roleId !== undefined) updateData.roleId = roleId;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (passwordChangeRequired !== undefined) updateData.passwordChangeRequired = passwordChangeRequired;
  if (password) updateData.passwordHash = await bcrypt.hash(password.trim(), 12);

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { role: true },
  });

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    isActive: updated.isActive,
    passwordChangeRequired: updated.passwordChangeRequired,
    role: { id: updated.role.id, name: updated.role.name },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(PERMISSIONS.USERS_DELETE);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent deleting self
  const me = await auth();
  if (me?.user?.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
