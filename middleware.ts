import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { type NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { localAuthBypassEnabled } from "@/lib/auth-mode";

const authMiddleware = withAuth({
  pages: {
    signIn: "/login"
  }
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (localAuthBypassEnabled) {
    return NextResponse.next();
  }

  return authMiddleware(request as NextRequestWithAuth, event);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/vehicles/:path*",
    "/simulator/:path*",
    "/market-research/:path*",
    "/expenses/:path*",
    "/processes/:path*",
    "/documents/:path*",
    "/photos/:path*",
    "/suppliers/:path*",
    "/sales/:path*",
    "/reports/:path*",
    "/settings/:path*"
  ]
};
