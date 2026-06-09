import { auth } from "@/lib/auth";

/**
 * All available permission codes in the system.
 * Used for type safety and to avoid magic strings.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  TRADES_VIEW: "trades.view",
  TRADES_CLOSE: "trades.close",
  BOT_VIEW: "bot.view",
  BOT_CONTROL: "bot.control",
  CONFIG_VIEW: "config.view",
  CONFIG_EDIT: "config.edit",
  RISK_VIEW: "risk.view",
  RISK_EDIT: "risk.edit",
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_DELETE: "users.delete",
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Server-side: check if the current session user has a specific permission.
 * Returns the session if permitted, null otherwise.
 */
export async function requirePermission(code: PermissionCode) {
  const session = await auth();
  if (!session) return null;

  const permissions: string[] = (session.user as { permissions?: string[] }).permissions ?? [];
  if (!permissions.includes(code)) return null;

  return session;
}

/**
 * Server-side: check if the current session user has ALL listed permissions.
 */
export async function requireAllPermissions(...codes: PermissionCode[]) {
  const session = await auth();
  if (!session) return null;

  const permissions: string[] = (session.user as { permissions?: string[] }).permissions ?? [];
  if (!codes.every((c) => permissions.includes(c))) return null;

  return session;
}

/**
 * Client-side helper: check permission against an array.
 * Used in components where session.user.permissions is already loaded.
 */
export function hasPermission(permissions: string[], code: PermissionCode): boolean {
  return permissions.includes(code);
}

/**
 * Client-side helper: check if user has any of the listed permissions.
 */
export function hasAnyPermission(permissions: string[], ...codes: PermissionCode[]): boolean {
  return codes.some((c) => permissions.includes(c));
}
