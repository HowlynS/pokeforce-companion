"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import { parseProfessionInput } from "@/lib/validation/profession";
import { isProfessionNameTaken } from "@/lib/admin/record-name";
import { resolveVerificationStamp } from "@/lib/game-versions";
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

export async function createProfessionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseProfessionInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/professions/new?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive) — the same helper the
  // live availability feedback queries, so the two can never disagree.
  if (await isProfessionNameTaken(prisma, parsed.value.name)) {
    redirect("/admin/professions/new?error=duplicate_name");
  }

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`/admin/professions/new?error=${verification.error}`);
  }

  // The optional image is uploaded only after every other validation has
  // passed, so a rejected submission never leaves an orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/professions/new?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("professions", imageFile);
    } catch {
      redirect("/admin/professions/new?error=upload_failed");
    }
  }

  let createdProfession;

  try {
    // Without the opt-in stamp both verification fields stay NULL — a
    // newly created profession is unverified by default.
    createdProfession = await prisma.profession.create({
      data: { ...parsed.value, image: imagePath, ...(verification.stamp ?? {}) },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

    if (isUniqueConstraintError(error)) {
      redirect("/admin/professions/new?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/professions");
  revalidatePath("/professions");

  // Admin Polish Pass 2, Part 2: straight to the new record's own
  // canonical editor, using the ACTUAL persisted slug from the created
  // row — never parsed.value.slug reconstructed independently.
  redirect(
    `/admin/professions/${createdProfession.slug}/edit?success=profession_created`
  );
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

  // Shared duplicate rule (trimmed, case-insensitive), excluding this very
  // record so it never conflicts with itself — the same helper the live
  // availability feedback queries, so the two can never disagree.
  const existingByName = await isProfessionNameTaken(
    prisma,
    parsed.value.name,
    id
  );

  if (existingByName) {
    redirect(`${editPath ?? "/admin/professions"}?error=duplicate_name`);
  }

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`${editPath ?? "/admin/professions"}?error=${verification.error}`);
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
    // Verification fields are included ONLY when the opt-in checkbox was
    // checked — a normal edit never alters or clears existing verification
    // metadata, because Prisma leaves omitted fields untouched.
    await prisma.profession.update({
      where: { id },
      data: { ...parsed.value, image: imageValue, ...(verification.stamp ?? {}) },
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

  // Admin Polish Pass 2, Part 1: back to the SAME canonical editor —
  // deliberately built from parsed.value.slug (the slug just PERSISTED),
  // never editPath's own originalSlug: if this very save also renamed the
  // profession, originalSlug's URL would 404 against the now-current row.
  // Every error redirect above still correctly uses editPath/originalSlug,
  // since on an error nothing was written and the record's real slug is
  // still whatever originalSlug says.
  redirect(
    oldImageCleanupFailed
      ? `/admin/professions/${parsed.value.slug}/edit?success=profession_saved_image_cleanup`
      : `/admin/professions/${parsed.value.slug}/edit?success=profession_saved`
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
      ? "/admin/professions?success=profession_deleted_image_cleanup"
      : "/admin/professions?success=profession_deleted"
  );
}
