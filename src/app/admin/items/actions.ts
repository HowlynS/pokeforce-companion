"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  isForeignKeyError,
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import { parseItemInput } from "@/lib/validation/item";
import { isItemNameTaken } from "@/lib/items/item-name";
import { getCurrentGameBuildId } from "@/lib/game-build";
import {
  deleteImage,
  uploadImage,
  validateImageFile,
} from "@/lib/storage/images";

// Browsers submit an empty File for an untouched file input, so both a
// missing value and a zero-byte value mean "no image was chosen".
function getSubmittedImageFile(formData: FormData): File | null {
  const value = formData.get("image");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

// The explicit opt-in verification action. The checkbox only ever carries
// intent ("on" or absent); both stamped values come exclusively from the
// server — the timestamp from the clock, the build id from the validated
// CURRENT_GAME_BUILD_ID environment value — so the browser can never submit
// an arbitrary build identifier. Returns null when the box was unchecked,
// and null with `failed: true` when the server has no configured build id.
function resolveVerificationStamp(formData: FormData):
  | { stamp: { verifiedAt: Date; verifiedBuildId: string } | null; failed: false }
  | { stamp: null; failed: true } {
  if (formData.get("markVerified") !== "on") {
    return { stamp: null, failed: false };
  }

  try {
    return {
      stamp: { verifiedAt: new Date(), verifiedBuildId: getCurrentGameBuildId() },
      failed: false,
    };
  } catch {
    return { stamp: null, failed: true };
  }
}

// Best-effort storage cleanup. Storage and the database cannot share a
// transaction, so a failed delete here must never replace or hide the
// outcome the user actually needs to see; the failure is logged (message
// only, never tokens or client state) and reported via the return value.
async function tryDeleteImage(objectPath: string | null): Promise<boolean> {
  if (!objectPath) {
    return true;
  }

  try {
    await deleteImage(objectPath);
    return true;
  } catch (error) {
    console.error(
      `Failed to delete stored image "${objectPath}":`,
      error instanceof Error ? error.message : "unknown error"
    );
    return false;
  }
}

export async function createItemAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseItemInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/items?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive) — the same helper the
  // live availability feedback queries, so the two can never disagree.
  if (await isItemNameTaken(prisma, parsed.value.name)) {
    redirect("/admin/items?error=duplicate_name");
  }

  // Resolved before any upload so a misconfigured build id rejects the
  // submission without leaving an orphaned file behind.
  const verification = resolveVerificationStamp(formData);

  if (verification.failed) {
    redirect("/admin/items?error=missing_build_id");
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

  // The optional image is uploaded only after every other validation has
  // passed, so a rejected submission never leaves an orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/items?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("items", imageFile);
    } catch {
      redirect("/admin/items?error=upload_failed");
    }
  }

  try {
    // Without the opt-in stamp both verification fields stay NULL — a newly
    // created item is unverified by default.
    await prisma.item.create({
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        description: parsed.value.description,
        heldItem: parsed.value.heldItem,
        tradeable: parsed.value.tradeable,
        baseValue: parsed.value.baseValue,
        categoryId: parsed.value.categoryId,
        image: imagePath,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

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

  // Shared duplicate rule (trimmed, case-insensitive), excluding this very
  // record so it never conflicts with itself — the same helper the live
  // availability feedback queries, so the two can never disagree.
  if (await isItemNameTaken(prisma, parsed.value.name, id)) {
    redirect(`${editPath ?? "/admin/items"}?error=duplicate_name`);
  }

  // Resolved before any upload so a misconfigured build id rejects the
  // submission without leaving an orphaned file behind.
  const verification = resolveVerificationStamp(formData);

  if (verification.failed) {
    redirect(`${editPath ?? "/admin/items"}?error=missing_build_id`);
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

  // The image intent comes from the submission, but the existing stored
  // path only ever comes from the database record loaded above — a
  // client-supplied path is never trusted to target a storage operation.
  const existingImagePath = existingItem.image;
  const imageFile = getSubmittedImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";

  if (imageFile && removeImage) {
    redirect(`${editPath ?? "/admin/items"}?error=conflicting_image_input`);
  }

  // Uploaded only after every other validation has passed, so a rejected
  // submission never leaves an orphaned file behind.
  let newImagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`${editPath ?? "/admin/items"}?error=${imageValidation.error}`);
    }

    try {
      newImagePath = await uploadImage("items", imageFile);
    } catch {
      redirect(`${editPath ?? "/admin/items"}?error=upload_failed`);
    }
  }

  // Replacement stores the new path, removal clears it, and an untouched
  // image control keeps the existing stored path.
  const imageValue = newImagePath ?? (removeImage ? null : existingImagePath);

  try {
    // Located by the stable cuid `id`, not the editable slug, so changing
    // the slug in this same submission cannot lose the target record.
    // Verification fields are included ONLY when the opt-in checkbox was
    // checked — a normal edit never alters or clears existing verification
    // metadata, because Prisma leaves omitted fields untouched.
    await prisma.item.update({
      where: { id },
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        description: parsed.value.description,
        heldItem: parsed.value.heldItem,
        tradeable: parsed.value.tradeable,
        baseValue: parsed.value.baseValue,
        categoryId: parsed.value.categoryId,
        image: imageValue,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    // The database still references the old image (or none), so the file
    // just uploaded for this failed update must not linger in storage.
    await tryDeleteImage(newImagePath);

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

  // Only after the database update has succeeded is the old file deleted.
  // If this cleanup fails, the update stays successful — an orphaned file
  // is less harmful than rolling the record back to a deleted path — and
  // the admin gets a distinct success message noting the leftover file.
  let oldImageCleanupFailed = false;

  if ((newImagePath !== null || removeImage) && existingImagePath) {
    oldImageCleanupFailed = !(await tryDeleteImage(existingImagePath));
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

  redirect(
    oldImageCleanupFailed
      ? "/admin/items?success=updated_image_cleanup"
      : "/admin/items?success=updated"
  );
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

  // Only after the database deletion has succeeded is the stored image
  // removed — database first, so a blocked or failed delete never strands
  // a surviving record pointing at a missing file. The path comes from the
  // trusted record loaded above, never from the client. If this cleanup
  // fails, the deletion stays successful and the admin gets a distinct
  // success message noting the leftover file.
  const imageCleanupFailed = !(await tryDeleteImage(item.image));

  revalidatePath("/admin/items");
  revalidatePath(confirmPath);
  revalidatePath("/items");
  revalidatePath(`/items/${itemSlug}`);
  revalidatePath("/categories");
  if (categorySlug) {
    revalidatePath(`/categories/${categorySlug}`);
  }

  redirect(
    imageCleanupFailed
      ? "/admin/items?success=deleted_image_cleanup"
      : "/admin/items?success=deleted"
  );
}
