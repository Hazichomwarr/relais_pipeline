import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_ROUTES = new Set(["/", "/login"]);

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  if (req.auth || PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.nextUrl);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
