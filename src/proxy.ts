import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { requiresPrivateSiteGate } from "@/lib/access/routes";
import { getSiteVisibility } from "@/lib/access/visibility";
import { loginPathFor } from "@/lib/auth/return-path";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (
    requiresPrivateSiteGate(request.nextUrl.pathname) &&
    (await getSiteVisibility()) === "PRIVATE_BETA" &&
    !user
  ) {
    const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(new URL(loginPathFor(returnTo), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
