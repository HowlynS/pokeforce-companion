"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/authorization";
import { changeSiteVisibility } from "@/lib/access/visibility-service";
import { prisma } from "@/lib/db";

export async function changeSiteVisibilityAction(formData: FormData) {
  const { user } = await requireOwner();
  const visibility = String(formData.get("visibility") ?? "");
  if (visibility !== "PRIVATE_BETA" && visibility !== "PUBLIC") {
    redirect("/admin/users?error=invalid_visibility");
  }
  if (formData.get("confirmed") !== "on") {
    redirect("/admin/users?error=confirmation_required");
  }

  try {
    await changeSiteVisibility(prisma, user.id, visibility);
  } catch {
    redirect("/admin/users?error=visibility_update_failed");
  }

  revalidatePath("/", "layout");
  revalidatePath("/robots.txt");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/users");
  redirect(`/admin/users?success=visibility_${visibility.toLowerCase()}`);
}
