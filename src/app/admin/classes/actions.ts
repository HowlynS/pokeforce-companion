"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import { parsePlayerClassInput } from "@/lib/validation/player-class";
import { toPrismaRichDescription } from "@/lib/rich-text-prisma";
import { isPlayerClassNameTaken } from "@/lib/admin/record-name";
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

export async function createPlayerClassAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parsePlayerClassInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/classes/new?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive) — the same helper the
  // live availability feedback queries, so the two can never disagree.
  if (await isPlayerClassNameTaken(prisma, parsed.value.name)) {
    redirect("/admin/classes/new?error=duplicate_name");
  }

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`/admin/classes/new?error=${verification.error}`);
  }

  // The optional image is uploaded only after every other validation has
  // passed, so a rejected submission never leaves an orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/classes/new?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("player-classes", imageFile);
    } catch {
      redirect("/admin/classes/new?error=upload_failed");
    }
  }

  let createdPlayerClass;

  try {
    // Without the opt-in stamp both verification fields stay NULL — a
    // newly created Player Class is unverified by default.
    createdPlayerClass = await prisma.playerClass.create({
      data: {
        ...toPrismaRichDescription(parsed.value),
        image: imagePath,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

    if (isUniqueConstraintError(error)) {
      redirect("/admin/classes/new?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/classes");
  revalidatePath("/classes");

  // Straight to the new record's own canonical editor, using the ACTUAL
  // persisted slug from the created row — never parsed.value.slug
  // reconstructed independently.
  redirect(
    `/admin/classes/${createdPlayerClass.slug}/edit?success=player_class_created`
  );
}

export async function updatePlayerClassAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug
    ? `/admin/classes/${originalSlug}/edit`
    : null;

  if (!id) {
    redirect("/admin/classes?error=missing_player_class");
  }

  const parsed = parsePlayerClassInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/classes"}?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive), excluding this very
  // record so it never conflicts with itself — the same helper the live
  // availability feedback queries, so the two can never disagree.
  const existingByName = await isPlayerClassNameTaken(
    prisma,
    parsed.value.name,
    id
  );

  if (existingByName) {
    redirect(`${editPath ?? "/admin/classes"}?error=duplicate_name`);
  }

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`${editPath ?? "/admin/classes"}?error=${verification.error}`);
  }

  // Loaded from the database so the existing stored image path is trusted —
  // a client-supplied path is never used to target a storage operation.
  const existingPlayerClass = await prisma.playerClass.findUnique({
    where: { id },
  });

  if (!existingPlayerClass) {
    redirect("/admin/classes?error=missing_player_class");
  }

  const existingImagePath = existingPlayerClass.image;
  const imageFile = getSubmittedImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";

  if (imageFile && removeImage) {
    redirect(`${editPath ?? "/admin/classes"}?error=conflicting_image_input`);
  }

  // Uploaded only after every other validation has passed, so a rejected
  // submission never leaves an orphaned file behind.
  let newImagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`${editPath ?? "/admin/classes"}?error=${imageValidation.error}`);
    }

    try {
      newImagePath = await uploadImage("player-classes", imageFile);
    } catch {
      redirect(`${editPath ?? "/admin/classes"}?error=upload_failed`);
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
    await prisma.playerClass.update({
      where: { id },
      data: {
        ...toPrismaRichDescription(parsed.value),
        image: imageValue,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    // The database still references the old image (or none), so the file
    // just uploaded for this failed update must not linger in storage.
    await tryDeleteImage(newImagePath);

    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/classes"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/classes?error=missing_player_class");
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

  revalidatePath("/admin/classes");
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath("/classes");
  if (originalSlug) {
    revalidatePath(`/classes/${originalSlug}`);
  }
  if (parsed.value.slug !== originalSlug) {
    revalidatePath(`/classes/${parsed.value.slug}`);
  }
  redirect(
    oldImageCleanupFailed
      ? `/admin/classes/${parsed.value.slug}/edit?success=player_class_saved_image_cleanup`
      : `/admin/classes/${parsed.value.slug}/edit?success=player_class_saved`
  );
}

export async function deletePlayerClassAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirmPath = slug ? `/admin/classes/${slug}/delete` : "/admin/classes";

  if (!id) {
    redirect("/admin/classes?error=missing_player_class");
  }

  const playerClass = await prisma.playerClass.findUnique({
    where: { id },
  });

  if (!playerClass) {
    redirect("/admin/classes?error=missing_player_class");
  }

  try {
    await prisma.playerClass.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/classes?error=missing_player_class");
    }
    throw error;
  }

  // Only after the database deletion has succeeded is the stored image
  // removed — database first, so a blocked or failed delete never strands
  // a surviving record pointing at a missing file. The path comes from the
  // trusted record loaded above, never from the client. If this cleanup
  // fails, the deletion stays successful and the admin gets a distinct
  // success message noting the leftover file.
  const imageCleanupFailed = !(await tryDeleteImage(playerClass.image));

  revalidatePath("/admin/classes");
  revalidatePath(confirmPath);
  revalidatePath("/classes");
  revalidatePath(`/classes/${playerClass.slug}`);

  redirect(
    imageCleanupFailed
      ? "/admin/classes?success=player_class_deleted_image_cleanup"
      : "/admin/classes?success=player_class_deleted"
  );
}
