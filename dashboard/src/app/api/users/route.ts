import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await requirePermission(PERMISSIONS.USERS_VIEW);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    include: { role: { include: { permissions: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      passwordChangeRequired: u.passwordChangeRequired,
      role: { id: u.role.id, name: u.role.name },
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await requirePermission(PERMISSIONS.USERS_CREATE);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { email, name, roleId, password } = body as {
    email: string;
    name?: string;
    roleId: string;
    password?: string;
  };

  if (!email?.trim() || !roleId) {
    return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const rawPassword = password?.trim() || "Password1!";
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      roleId,
      passwordHash,
      passwordChangeRequired: !password,
    },
    include: { role: true },
  });

  return NextResponse.json(
    { id: user.id, email: user.email, name: user.name, isActive: user.isActive, role: { id: user.role.id, name: user.role.name } },
    { status: 201 }
  );
}
