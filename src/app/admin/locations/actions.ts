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
import { parseLocationInput } from "@/lib/validation/location";
import { isLocationNameTaken } from "@/lib/admin/record-name";
import { wouldCreateLocationCycle } from "@/lib/locations/location-hierarchy";
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

export async function createLocationAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseLocationInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/locations/new?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive) — the same helper the
  // live availability feedback queries, so the two can never disagree.
  if (await isLocationNameTaken(prisma, parsed.value.name)) {
    redirect("/admin/locations/new?error=duplicate_name");
  }

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`/admin/locations/new?error=${verification.error}`);
  }

  // A submitted parent id is never trusted blindly: it must correspond to
  // an existing Location before the location is created. A brand-new
  // location has no id yet, so it cannot be its own ancestor — no cycle
  // check is needed here, only on edit.
  if (parsed.value.parentId) {
    const parent = await prisma.location.findUnique({
      where: { id: parsed.value.parentId },
    });

    if (!parent) {
      redirect("/admin/locations/new?error=invalid_parent");
    }
  }

  // The optional image is uploaded only after every other validation has
  // passed, so a rejected submission never leaves an orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/locations/new?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("locations", imageFile);
    } catch {
      redirect("/admin/locations/new?error=upload_failed");
    }
  }

  try {
    // Without the opt-in stamp both verification fields stay NULL — a
    // newly created location is unverified by default.
    await prisma.location.create({
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        type: parsed.value.type,
        parentId: parsed.value.parentId,
        description: parsed.value.description,
        accessNote: parsed.value.accessNote,
        image: imagePath,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

    if (isUniqueConstraintError(error)) {
      redirect("/admin/locations/new?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/locations");
  revalidatePath("/locations");

  redirect("/admin/locations?success=created");
}

export async function updateLocationAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug ? `/admin/locations/${originalSlug}/edit` : null;

  if (!id) {
    redirect("/admin/locations?error=missing_location");
  }

  const parsed = parseLocationInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/locations"}?error=${parsed.error}`);
  }

  // Loaded from the database, not trusted from the client, so the existing
  // stored image path is trusted for a storage operation.
  const existingLocation = await prisma.location.findUnique({
    where: { id },
  });

  if (!existingLocation) {
    redirect("/admin/locations?error=missing_location");
  }

  // Shared duplicate rule (trimmed, case-insensitive), excluding this very
  // record so it never conflicts with itself — the same helper the live
  // availability feedback queries, so the two can never disagree.
  if (await isLocationNameTaken(prisma, parsed.value.name, id)) {
    redirect(`${editPath ?? "/admin/locations"}?error=duplicate_name`);
  }

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`${editPath ?? "/admin/locations"}?error=${verification.error}`);
  }

  // A submitted parent id is never trusted blindly: it must correspond to
  // an existing Location, must not be the location itself, and must not be
  // one of the location's own descendants (which would create a cycle).
  if (parsed.value.parentId) {
    const parent = await prisma.location.findUnique({
      where: { id: parsed.value.parentId },
    });

    if (!parent) {
      redirect(`${editPath ?? "/admin/locations"}?error=invalid_parent`);
    }

    if (await wouldCreateLocationCycle(prisma, id, parsed.value.parentId)) {
      redirect(`${editPath ?? "/admin/locations"}?error=cyclic_parent`);
    }
  }

  const existingImagePath = existingLocation.image;
  const imageFile = getSubmittedImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";

  if (imageFile && removeImage) {
    redirect(`${editPath ?? "/admin/locations"}?error=conflicting_image_input`);
  }

  // Uploaded only after every other validation has passed, so a rejected
  // submission never leaves an orphaned file behind.
  let newImagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`${editPath ?? "/admin/locations"}?error=${imageValidation.error}`);
    }

    try {
      newImagePath = await uploadImage("locations", imageFile);
    } catch {
      redirect(`${editPath ?? "/admin/locations"}?error=upload_failed`);
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
    await prisma.location.update({
      where: { id },
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        type: parsed.value.type,
        parentId: parsed.value.parentId,
        description: parsed.value.description,
        accessNote: parsed.value.accessNote,
        image: imageValue,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    // The database still references the old image (or none), so the file
    // just uploaded for this failed update must not linger in storage.
    await tryDeleteImage(newImagePath);

    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/locations"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/locations?error=missing_location");
    }
    if (isForeignKeyError(error)) {
      redirect(`${editPath ?? "/admin/locations"}?error=invalid_parent`);
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

  revalidatePath("/admin/locations");
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath("/locations");
  if (originalSlug) {
    revalidatePath(`/locations/${originalSlug}`);
  }
  if (parsed.value.slug !== originalSlug) {
    revalidatePath(`/locations/${parsed.value.slug}`);
  }

  redirect(
    oldImageCleanupFailed
      ? "/admin/locations?success=updated_image_cleanup"
      : "/admin/locations?success=updated"
  );
}

export async function deleteLocationAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirmPath = slug ? `/admin/locations/${slug}/delete` : "/admin/locations";

  if (!id) {
    redirect("/admin/locations?error=missing_location");
  }

  const location = await prisma.location.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });

  if (!location) {
    redirect("/admin/locations?error=missing_location");
  }

  // Checked immediately before deletion, not just on the confirmation page
  // load, so a concurrently-added child location can't slip through.
  // Children are never silently detached — the database's own
  // onDelete: Restrict on Location.parentId backs this same rule up.
  if (location._count.children > 0) {
    redirect(`${confirmPath}?error=linked_locations`);
  }

  const locationSlug = location.slug;

  try {
    await prisma.location.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/locations?error=missing_location");
    }
    if (isForeignKeyError(error)) {
      // A child location appeared between the count check and the delete
      // call; treat it the same as a normal blocked deletion.
      redirect(`${confirmPath}?error=linked_locations`);
    }
    throw error;
  }

  // Only after the database deletion has succeeded is the stored image
  // removed — database first, so a blocked or failed delete never strands
  // a surviving record pointing at a missing file. The path comes from the
  // trusted record loaded above, never from the client. If this cleanup
  // fails, the deletion stays successful and the admin gets a distinct
  // success message noting the leftover file.
  const imageCleanupFailed = !(await tryDeleteImage(location.image));

  revalidatePath("/admin/locations");
  revalidatePath(confirmPath);
  revalidatePath("/locations");
  revalidatePath(`/locations/${locationSlug}`);

  redirect(
    imageCleanupFailed
      ? "/admin/locations?success=deleted_image_cleanup"
      : "/admin/locations?success=deleted"
  );
}
