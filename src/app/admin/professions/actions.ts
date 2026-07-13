"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { parseProfessionInput } from "@/lib/validation/profession";
import {
  deleteImage,
  uploadImage,
  validateImageFile,
} from "@/lib/storage/images";

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

export async function createProfessionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseProfessionInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/professions?error=${parsed.error}`);
  }

  const existingByName = await prisma.profession.findFirst({
    where: { name: { equals: parsed.value.name, mode: "insensitive" } },
  });

  if (existingByName) {
    redirect("/admin/professions?error=duplicate_name");
  }

  // The optional image is uploaded only after every other validation has
  // passed, so a rejected submission never leaves an orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/professions?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("professions", imageFile);
    } catch {
      redirect("/admin/professions?error=upload_failed");
    }
  }

  try {
    await prisma.profession.create({
      data: { ...parsed.value, image: imagePath },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

    if (isUniqueConstraintError(error)) {
      redirect("/admin/professions?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/professions");
  revalidatePath("/professions");

  redirect("/admin/professions?success=created");
}

export async function updateProfessionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug
    ? `/admin/professions/${originalSlug}/edit`
    : null;

  if (!id) {
    redirect("/admin/professions?error=missing_profession");
  }

  const parsed = parseProfessionInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/professions"}?error=${parsed.error}`);
  }

  const existingByName = await prisma.profession.findFirst({
    where: {
      name: { equals: parsed.value.name, mode: "insensitive" },
      NOT: { id },
    },
  });

  if (existingByName) {
    redirect(`${editPath ?? "/admin/professions"}?error=duplicate_name`);
  }

  // Loaded from the database so the existing stored image path is trusted —
  // a client-supplied path is never used to target a storage operation.
  const existingProfession = await prisma.profession.findUnique({
    where: { id },
  });

  if (!existingProfession) {
    redirect("/admin/professions?error=missing_profession");
  }

  const existingImagePath = existingProfession.image;
  const imageFile = getSubmittedImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";

  if (imageFile && removeImage) {
    redirect(
      `${editPath ?? "/admin/professions"}?error=conflicting_image_input`
    );
  }

  // Uploaded only after every other validation has passed, so a rejected
  // submission never leaves an orphaned file behind.
  let newImagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(
        `${editPath ?? "/admin/professions"}?error=${imageValidation.error}`
      );
    }

    try {
      newImagePath = await uploadImage("professions", imageFile);
    } catch {
      redirect(`${editPath ?? "/admin/professions"}?error=upload_failed`);
    }
  }

  // Replacement stores the new path, removal clears it, and an untouched
  // image control keeps the existing stored path.
  const imageValue = newImagePath ?? (removeImage ? null : existingImagePath);

  try {
    // Located by the stable cuid `id`, not the editable slug, so changing
    // the slug in this same submission cannot lose the target record.
    await prisma.profession.update({
      where: { id },
      data: { ...parsed.value, image: imageValue },
    });
  } catch (error) {
    // The database still references the old image (or none), so the file
    // just uploaded for this failed update must not linger in storage.
    await tryDeleteImage(newImagePath);

    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/professions"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/professions?error=missing_profession");
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

  revalidatePath("/admin/professions");
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath("/professions");
  if (originalSlug) {
    revalidatePath(`/professions/${originalSlug}`);
  }
  if (parsed.value.slug !== originalSlug) {
    revalidatePath(`/professions/${parsed.value.slug}`);
  }

  redirect(
    oldImageCleanupFailed
      ? "/admin/professions?success=updated_image_cleanup"
      : "/admin/professions?success=updated"
  );
}

export async function deleteProfessionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirmPath = slug
    ? `/admin/professions/${slug}/delete`
    : "/admin/professions";

  if (!id) {
    redirect("/admin/professions?error=missing_profession");
  }

  const profession = await prisma.profession.findUnique({
    where: { id },
    include: { _count: { select: { recipes: true } } },
  });

  if (!profession) {
    redirect("/admin/professions?error=missing_profession");
  }

  // Checked immediately before deletion, not just on the confirmation page
  // load, so a concurrently-linked recipe can't slip through. The
  // application rule is that linked professions are preserved until their
  // recipes are manually reassigned in a later slice — never silently
  // detached.
  if (profession._count.recipes > 0) {
    redirect(`${confirmPath}?error=linked_recipes`);
  }

  try {
    await prisma.profession.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/professions?error=missing_profession");
    }
    throw error;
  }

  // Only after the database deletion has succeeded is the stored image
  // removed — database first, so a blocked or failed delete never strands
  // a surviving record pointing at a missing file. The path comes from the
  // trusted record loaded above, never from the client. If this cleanup
  // fails, the deletion stays successful and the admin gets a distinct
  // success message noting the leftover file.
  const imageCleanupFailed = !(await tryDeleteImage(profession.image));

  revalidatePath("/admin/professions");
  revalidatePath(confirmPath);
  revalidatePath("/professions");
  revalidatePath(`/professions/${profession.slug}`);

  redirect(
    imageCleanupFailed
      ? "/admin/professions?success=deleted_image_cleanup"
      : "/admin/professions?success=deleted"
  );
}
