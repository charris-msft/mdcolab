import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  const pathname = request.nextUrl.pathname;

  if (!token) {
    // Allow anonymous access to /d/* routes — page/API handles access checks
    if (pathname.startsWith("/d/")) {
      const response = NextResponse.next();
      response.headers.set("x-pathname", pathname);
      return response;
    }
    // All other protected routes require authentication
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Always forward the pathname so the layout can read it
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/repos/:path*", "/d/:path*", "/shared/:path*"],
};
