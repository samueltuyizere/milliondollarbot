"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import type { PermissionCode } from "@/lib/permissions";

/**
 * Returns the current user's permissions array and helper functions.
 * Only works in Client Components (uses next-auth/react useSession).
 */
export function usePermissions() {
  const { data: session } = useSession();

  const permissions: string[] = useMemo(
    () => (session?.user as { permissions?: string[] })?.permissions ?? [],
    [session]
  );

  const role: string = useMemo(
    () => (session?.user as { role?: string })?.role ?? "",
    [session]
  );

  function can(code: PermissionCode): boolean {
    return permissions.includes(code);
  }

  function canAny(...codes: PermissionCode[]): boolean {
    return codes.some((c) => permissions.includes(c));
  }

  function canAll(...codes: PermissionCode[]): boolean {
    return codes.every((c) => permissions.includes(c));
  }

  return { permissions, role, can, canAny, canAll };
}
