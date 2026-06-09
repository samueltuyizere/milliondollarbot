import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/** Routes accessible without authentication (bot heartbeat / trade writes from Python bot) */
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/bot/heartbeat",
  "/api/trades",
  "/api/logs/system",
];

/** Permission required to access specific route prefixes */
const PERMISSION_ROUTES: Array<{ prefix: string; permission: string }> = [
  { prefix: "/settings/users", permission: "users.view" },
  { prefix: "/settings/roles", permission: "roles.view" },
  { prefix: "/api/users",      permission: "users.view" },
  { prefix: "/api/roles",      permission: "roles.view" },
  { prefix: "/api/permissions",permission: "roles.view" },
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Always allow public API routes (used by bot process, no user session)
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from login page
  if (pathname.startsWith("/login")) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Permission-based route guards
  const permissions: string[] =
    (req.auth?.user as { permissions?: string[] })?.permissions ?? [];

  for (const { prefix, permission } of PERMISSION_ROUTES) {
    if (pathname.startsWith(prefix) && !permissions.includes(permission)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
