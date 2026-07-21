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
import { isCategoryNameTaken } from "@/lib/admin/record-name";
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

export async function createCategoryAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseCategoryInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/categories/new?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive) — the same helper the
  // live availability feedback queries, so the two can never disagree.
  if (await isCategoryNameTaken(prisma, parsed.value.name)) {
    redirect("/admin/categories/new?error=duplicate_name");
  }

  // The optional image is uploaded only after every other validation has
  // passed, so a rejected submission never leaves an orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/categories/new?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("categories", imageFile);
    } catch {
      redirect("/admin/categories/new?error=upload_failed");
    }
  }

  try {
    await prisma.category.create({
      data: { ...parsed.value, image: imagePath },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

    if (isUniqueConstraintError(error)) {
      redirect("/admin/categories/new?error=duplicate");
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

  // Loaded from the database, not trusted from the client, so we know the
  // category's previous stored image even if the form's hidden fields were
  // tampered with or are stale.
  const existingCategory = await prisma.category.findUnique({
    where: { id },
  });

  if (!existingCategory) {
    redirect("/admin/categories?error=missing_category");
  }

  // Shared duplicate rule (trimmed, case-insensitive), excluding this very
  // record so it never conflicts with itself — the same helper the live
  // availability feedback queries, so the two can never disagree.
  const existingByName = await isCategoryNameTaken(
    prisma,
    parsed.value.name,
    id
  );

  if (existingByName) {
    redirect(`${editPath ?? "/admin/categories"}?error=duplicate_name`);
  }

  // The image intent comes from the submission, but the existing stored
  // path only ever comes from the database record loaded above — a
  // client-supplied path is never trusted to target a storage operation.
  const existingImagePath = existingCategory.image;
  const imageFile = getSubmittedImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";

  if (imageFile && removeImage) {
    redirect(`${editPath ?? "/admin/categories"}?error=conflicting_image_input`);
  }

  // Uploaded only after every other validation has passed, so a rejected
  // submission never leaves an orphaned file behind.
  let newImagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`${editPath ?? "/admin/categories"}?error=${imageValidation.error}`);
    }

    try {
      newImagePath = await uploadImage("categories", imageFile);
    } catch {
      redirect(`${editPath ?? "/admin/categories"}?error=upload_failed`);
    }
  }

  // Replacement stores the new path, removal clears it, and an untouched
  // image control keeps the existing stored path.
  const imageValue = newImagePath ?? (removeImage ? null : existingImagePath);

  try {
    // Located by the stable cuid `id`, not the editable slug, so changing
    // the slug in this same submission cannot lose the target record.
    await prisma.category.update({
      where: { id },
      data: { ...parsed.value, image: imageValue },
    });
  } catch (error) {
    // The database still references the old image (or none), so the file
    // just uploaded for this failed update must not linger in storage.
    await tryDeleteImage(newImagePath);

    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/categories"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/categories?error=missing_category");
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

  redirect(
    oldImageCleanupFailed
      ? "/admin/categories?success=updated_image_cleanup"
      : "/admin/categories?success=updated"
  );
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

  // Only after the database deletion has succeeded is the stored image
  // removed — database first, so a blocked or failed delete never strands
  // a surviving record pointing at a missing file. The path comes from the
  // trusted record loaded above, never from the client. If this cleanup
  // fails, the deletion stays successful and the admin gets a distinct
  // success message noting the leftover file.
  const imageCleanupFailed = !(await tryDeleteImage(category.image));

  revalidatePath("/admin/categories");
  revalidatePath(confirmPath);
  revalidatePath("/categories");
  revalidatePath(`/categories/${category.slug}`);

  redirect(
    imageCleanupFailed
      ? "/admin/categories?success=deleted_image_cleanup"
      : "/admin/categories?success=deleted"
  );
}
