"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { resolveApplicationUserForIdentity } from "@/lib/auth/bootstrap-owner";
import { safeReturnPath } from "@/lib/auth/return-path";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    redirect("/login?error=missing_fields");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  const user = data.user
    ? await resolveApplicationUserForIdentity(
        prisma,
        data.user,
        process.env.ADMIN_EMAIL
      )
    : null;

  if (!user) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?error=unprovisioned");
  }
  if (user.status !== "ACTIVE") {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?error=disabled");
  }

  await prisma.appUser.update({
    where: { id: user.id },
    data: { lastKnownSignInAt: new Date() },
  });

  redirect(returnTo);
}
