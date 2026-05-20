import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isWhatsApp = req.nextUrl.pathname.startsWith("/api/whatsapp");

  if (isApiAuth || isWhatsApp) return NextResponse.next();
  if (isLoginPage) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/timesheet", req.url));
    return NextResponse.next();
  }
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
