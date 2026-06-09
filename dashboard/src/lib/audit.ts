import { prisma } from "@/lib/prisma";

export async function logAudit({
  userId,
  action,
  resource,
  oldValue,
  newValue,
  ipAddress,
}: {
  userId?: string;
  action: string;
  resource?: string;
  oldValue?: object;
  newValue?: object;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: { userId, action, resource, oldValue, newValue, ipAddress },
  });
}

export async function logSystem({
  level,
  source,
  message,
  metadata,
}: {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  source: string;
  message: string;
  metadata?: object;
}) {
  await prisma.systemLog.create({
    data: { level, source, message, metadata },
  });
}
