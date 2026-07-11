"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { parseItemInput } from "@/lib/validation/item";

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

function isMissingRecordError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

function isForeignKeyError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

export async function createItemAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseItemInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/items?error=${parsed.error}`);
  }

  const existingByName = await prisma.item.findFirst({
    where: { name: { equals: parsed.value.name, mode: "insensitive" } },
  });

  if (existingByName) {
    redirect("/admin/items?error=duplicate_name");
  }

  // A submitted category ID is never trusted blindly: it must correspond to
  // an existing Category before the item is created.
  let categorySlug: string | null = null;

  if (parsed.value.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: parsed.value.categoryId },
    });

    if (!category) {
      redirect("/admin/items?error=invalid_category");
    }

    categorySlug = category.slug;
  }

  try {
    await prisma.item.create({
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        description: parsed.value.description,
        rarity: parsed.value.rarity,
        tradeable: parsed.value.tradeable,
        baseValue: parsed.value.baseValue,
        categoryId: parsed.value.categoryId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/items?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/items");
  revalidatePath("/items");
  revalidatePath("/categories");
  if (categorySlug) {
    revalidatePath(`/categories/${categorySlug}`);
  }

  redirect("/admin/items?success=created");
}

export async function updateItemAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug ? `/admin/items/${originalSlug}/edit` : null;

  if (!id) {
    redirect("/admin/items?error=missing_item");
  }

  const parsed = parseItemInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/items"}?error=${parsed.error}`);
  }

  // Loaded from the database, not trusted from the client, so we know the
  // item's previous Category (for revalidation) even if the form's hidden
  // fields were tampered with or are stale.
  const existingItem = await prisma.item.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!existingItem) {
    redirect("/admin/items?error=missing_item");
  }

  const existingByName = await prisma.item.findFirst({
    where: {
      name: { equals: parsed.value.name, mode: "insensitive" },
      NOT: { id },
    },
  });

  if (existingByName) {
    redirect(`${editPath ?? "/admin/items"}?error=duplicate_name`);
  }

  // A submitted category ID is never trusted blindly: it must correspond to
  // an existing Category before the item is updated.
  let newCategorySlug: string | null = null;

  if (parsed.value.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: parsed.value.categoryId },
    });

    if (!category) {
      redirect(`${editPath ?? "/admin/items"}?error=invalid_category`);
    }

    newCategorySlug = category.slug;
  }

  try {
    // Located by the stable cuid `id`, not the editable slug, so changing
    // the slug in this same submission cannot lose the target record.
    await prisma.item.update({
      where: { id },
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        description: parsed.value.description,
        rarity: parsed.value.rarity,
        tradeable: parsed.value.tradeable,
        baseValue: parsed.value.baseValue,
        categoryId: parsed.value.categoryId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/items"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/items?error=missing_item");
    }
    if (isForeignKeyError(error)) {
      redirect(`${editPath ?? "/admin/items"}?error=invalid_category`);
    }
    throw error;
  }

  revalidatePath("/admin/items");
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath("/items");
  if (originalSlug) {
    revalidatePath(`/items/${originalSlug}`);
  }
  if (parsed.value.slug !== originalSlug) {
    revalidatePath(`/items/${parsed.value.slug}`);
  }

  revalidatePath("/categories");
  const oldCategorySlug = existingItem.category?.slug ?? null;
  if (oldCategorySlug) {
    revalidatePath(`/categories/${oldCategorySlug}`);
  }
  if (newCategorySlug && newCategorySlug !== oldCategorySlug) {
    revalidatePath(`/categories/${newCategorySlug}`);
  }

  redirect("/admin/items?success=updated");
}

export async function deleteItemAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirmPath = slug ? `/admin/items/${slug}/delete` : "/admin/items";

  if (!id) {
    redirect("/admin/items?error=missing_item");
  }

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      category: true,
      _count: { select: { recipesProduced: true, recipeIngredients: true } },
    },
  });

  if (!item) {
    redirect("/admin/items?error=missing_item");
  }

  // Checked immediately before deletion, not just on the confirmation page
  // load, so a concurrently-added recipe reference can't slip through. Both
  // relation paths (an Item can be a recipe's result and/or an ingredient
  // in others) must be clear before deletion is allowed.
  const resultCount = item._count.recipesProduced;
  const ingredientCount = item._count.recipeIngredients;

  if (resultCount > 0 || ingredientCount > 0) {
    redirect(`${confirmPath}?error=linked_recipes`);
  }

  const categorySlug = item.category?.slug ?? null;
  const itemSlug = item.slug;

  try {
    await prisma.item.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/items?error=missing_item");
    }
    if (isForeignKeyError(error)) {
      // A recipe reference appeared between the count check and the delete
      // call; treat it the same as a normal blocked deletion.
      redirect(`${confirmPath}?error=linked_recipes`);
    }
    throw error;
  }

  revalidatePath("/admin/items");
  revalidatePath(confirmPath);
  revalidatePath("/items");
  revalidatePath(`/items/${itemSlug}`);
  revalidatePath("/categories");
  if (categorySlug) {
    revalidatePath(`/categories/${categorySlug}`);
  }

  redirect("/admin/items?success=deleted");
}
