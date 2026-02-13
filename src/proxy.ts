import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token) {
    // Allow anonymous access to /d/* routes — page/API handles access checks
    if (request.nextUrl.pathname.startsWith("/d/")) {
      const response = NextResponse.next();
      response.headers.set("x-pathname", request.nextUrl.pathname);
      return response;
    }
    // All other protected routes require authentication
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/repos/:path*", "/d/:path*"],
};
