import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { localAuthBypassEnabled } from "@/lib/auth-mode";

const authMiddleware = withAuth({
  pages: {
    signIn: "/login"
  }
});

export default function middleware(request: Request) {
  if (localAuthBypassEnabled) {
    return NextResponse.next();
  }

  return authMiddleware(request as never);
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
