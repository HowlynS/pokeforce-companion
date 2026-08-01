"use server";

import { redirect } from "next/navigation";
import { requireActiveSiteUser } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export async function changeOwnPasswordAction(formData: FormData) {
  await requireActiveSiteUser();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  if (password.length < 12 || password.length > 128) {
    redirect("/account/password?error=invalid_password");
  }
  if (password !== confirmation) {
    redirect("/account/password?error=password_mismatch");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/account/password?error=update_failed");
  redirect("/account/password?success=password_changed");
}
