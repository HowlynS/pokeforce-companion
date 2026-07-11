import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Server-only gate for the admin area. Redirects unauthenticated visitors to
 * /login and denies access to any authenticated user whose email does not
 * match ADMIN_EMAIL. Wrapped in React's cache() so repeated calls within the
 * same request (layout + page) reuse one Supabase lookup.
 */
export const requireAdminUser = cache(async function requireAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    // Fail securely: without a configured admin email, no one can be admin.
    throw new Error(
      "ADMIN_EMAIL is not configured. Set it before using the admin area."
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  if (normalizeEmail(user.email) !== normalizeEmail(adminEmail)) {
    redirect("/login?error=not_authorized");
  }

  return user;
});
