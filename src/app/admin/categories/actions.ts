"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import { parseCategoryInput } from "@/lib/validation/category";

export async function createCategoryAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseCategoryInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/categories?error=${parsed.error}`);
  }

  const existingByName = await prisma.category.findFirst({
    where: { name: { equals: parsed.value.name, mode: "insensitive" } },
  });

  if (existingByName) {
    redirect("/admin/categories?error=duplicate_name");
  }

  try {
    await prisma.category.create({ data: parsed.value });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/categories?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/categories");
  revalidatePath("/categories");

  redirect("/admin/categories?success=created");
}

export async function updateCategoryAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug ? `/admin/categories/${originalSlug}/edit` : null;

  if (!id) {
    redirect("/admin/categories?error=missing_category");
  }

  const parsed = parseCategoryInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/categories"}?error=${parsed.error}`);
  }

  const existingByName = await prisma.category.findFirst({
    where: {
      name: { equals: parsed.value.name, mode: "insensitive" },
      NOT: { id },
    },
  });

  if (existingByName) {
    redirect(`${editPath ?? "/admin/categories"}?error=duplicate_name`);
  }

  try {
    // Located by the stable cuid `id`, not the editable slug, so changing
    // the slug in this same submission cannot lose the target record.
    await prisma.category.update({ where: { id }, data: parsed.value });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/categories"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/categories?error=missing_category");
    }
    throw error;
  }

  revalidatePath("/admin/categories");
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath("/categories");
  if (originalSlug) {
    revalidatePath(`/categories/${originalSlug}`);
  }
  if (parsed.value.slug !== originalSlug) {
    revalidatePath(`/categories/${parsed.value.slug}`);
  }

  redirect("/admin/categories?success=updated");
}

export async function deleteCategoryAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirmPath = slug ? `/admin/categories/${slug}/delete` : "/admin/categories";

  if (!id) {
    redirect("/admin/categories?error=missing_category");
  }

  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });

  if (!category) {
    redirect("/admin/categories?error=missing_category");
  }

  // Checked immediately before deletion, not just on the confirmation page
  // load, so a concurrently-linked item can't slip through. The application
  // rule is that linked categories are preserved until their items are
  // manually reassigned in a later slice — never silently set to null.
  if (category._count.items > 0) {
    redirect(`${confirmPath}?error=linked_items`);
  }

  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/categories?error=missing_category");
    }
    throw error;
  }

  revalidatePath("/admin/categories");
  revalidatePath(confirmPath);
  revalidatePath("/categories");
  revalidatePath(`/categories/${category.slug}`);

  redirect("/admin/categories?success=deleted");
}
