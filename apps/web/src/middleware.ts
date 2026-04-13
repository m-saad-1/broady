import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedRoutes = ["/checkout", "/admin", "/account", "/brand/dashboard", "/brand/orders", "/brand-dashboard"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("broady_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/checkout/:path*", "/admin/:path*", "/account/:path*", "/brand/dashboard/:path*", "/brand/orders/:path*", "/brand-dashboard/:path*"],
};
