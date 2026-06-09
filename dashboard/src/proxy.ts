import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isBotApi = req.nextUrl.pathname.startsWith("/api/bot/heartbeat") ||
    req.nextUrl.pathname.startsWith("/api/trades") ||
    req.nextUrl.pathname.startsWith("/api/logs/system");

  if (isApiAuth || isBotApi) return NextResponse.next();
  if (isAuthPage) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }
  if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
