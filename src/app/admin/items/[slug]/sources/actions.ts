"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  isForeignKeyError,
  isMissingRecordError,
} from "@/lib/prisma-errors";
import { parseAcquisitionSourceInput } from "@/lib/validation/acquisition-source";
import { resolveVerificationStamp } from "@/lib/game-versions";

// A submitted location/profession id is never trusted blindly: each must
// correspond to an existing row before the source is created or updated.
// Returns the specific error to redirect with, or null when both are valid
// (or simply absent).
async function findInvalidRelationError(
  locationId: string | null,
  professionId: string | null
): Promise<"invalid_location" | "invalid_profession" | null> {
  if (locationId) {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });
    if (!location) {
      return "invalid_location";
    }
  }

  if (professionId) {
    const profession = await prisma.profession.findUnique({
      where: { id: professionId },
    });
    if (!profession) {
      return "invalid_profession";
    }
  }

  return null;
}

export async function createAcquisitionSourceAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const itemId = String(formData.get("itemId") ?? "").trim();
  const itemSlug = String(formData.get("itemSlug") ?? "").trim();
  const sourcesPath = itemSlug ? `/admin/items/${itemSlug}/sources` : "/admin/items";

  if (!itemId) {
    redirect("/admin/items?error=missing_item");
  }

  // Loaded from the database, not trusted from the client: the item this
  // source is being attached to must actually exist.
  const item = await prisma.item.findUnique({ where: { id: itemId } });

  if (!item) {
    redirect("/admin/items?error=missing_item");
  }

  const parsed = parseAcquisitionSourceInput(formData);

  if (!parsed.ok) {
    redirect(`${sourcesPath}?error=${parsed.error}`);
  }

  // The shared helper stamps the server's own clock and the database row
  // marked current when the form supplies no selection, or a
  // server-validated explicitly selected version — a nonexistent or
  // tampered id fails the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`${sourcesPath}?error=${verification.error}`);
  }

  const relationError = await findInvalidRelationError(
    parsed.value.locationId,
    parsed.value.professionId
  );

  if (relationError) {
    redirect(`${sourcesPath}?error=${relationError}`);
  }

  await prisma.acquisitionSource.create({
    data: {
      itemId,
      type: parsed.value.type,
      locationId: parsed.value.locationId,
      professionId: parsed.value.professionId,
      sourceLabel: parsed.value.sourceLabel,
      notes: parsed.value.notes,
      quantity: parsed.value.quantity,
      ...(verification.stamp ?? {}),
    },
  });

  revalidatePath(sourcesPath);
  revalidatePath(`/items/${itemSlug}`);

  redirect(`${sourcesPath}?success=created`);
}

export async function updateAcquisitionSourceAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const itemSlug = String(formData.get("itemSlug") ?? "").trim();
  const sourcesPath = itemSlug ? `/admin/items/${itemSlug}/sources` : "/admin/items";
  const editPath = itemSlug && id ? `${sourcesPath}/${id}/edit` : null;

  if (!id || !itemSlug) {
    redirect(`${sourcesPath}?error=missing_source`);
  }

  // The item is resolved fresh from the URL slug (never trusted as a bare
  // id), and the source must belong to EXACTLY that item. A source id
  // submitted alongside a stale or mismatched itemSlug — the two hidden
  // fields disagreeing about which item this edit is for — is treated the
  // same as a missing source, never silently applied to a different
  // item's row.
  const item = await prisma.item.findUnique({ where: { slug: itemSlug } });

  if (!item) {
    redirect("/admin/items?error=missing_item");
  }

  const existing = await prisma.acquisitionSource.findUnique({
    where: { id },
  });

  if (!existing || existing.itemId !== item.id) {
    redirect(`${sourcesPath}?error=missing_source`);
  }

  const parsed = parseAcquisitionSourceInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? sourcesPath}?error=${parsed.error}`);
  }

  // The shared helper stamps the server's own clock and the database row
  // marked current when the form supplies no selection, or a
  // server-validated explicitly selected version — a nonexistent or
  // tampered id fails the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`${editPath ?? sourcesPath}?error=${verification.error}`);
  }

  const relationError = await findInvalidRelationError(
    parsed.value.locationId,
    parsed.value.professionId
  );

  if (relationError) {
    redirect(`${editPath ?? sourcesPath}?error=${relationError}`);
  }

  try {
    // Verification fields are included ONLY when the opt-in checkbox was
    // checked — a normal edit never alters or clears existing verification
    // metadata, because Prisma leaves omitted fields untouched.
    await prisma.acquisitionSource.update({
      where: { id },
      data: {
        type: parsed.value.type,
        locationId: parsed.value.locationId,
        professionId: parsed.value.professionId,
        sourceLabel: parsed.value.sourceLabel,
        notes: parsed.value.notes,
        quantity: parsed.value.quantity,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect(`${sourcesPath}?error=missing_source`);
    }
    if (isForeignKeyError(error)) {
      redirect(`${editPath ?? sourcesPath}?error=invalid_location`);
    }
    throw error;
  }

  revalidatePath(sourcesPath);
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath(`/items/${itemSlug}`);

  redirect(`${sourcesPath}?success=updated`);
}

export async function deleteAcquisitionSourceAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const itemSlug = String(formData.get("itemSlug") ?? "").trim();
  const sourcesPath = itemSlug ? `/admin/items/${itemSlug}/sources` : "/admin/items";

  if (!id || !itemSlug) {
    redirect(`${sourcesPath}?error=missing_source`);
  }

  // The item is resolved fresh from the URL slug (never trusted as a bare
  // id), and the source must belong to EXACTLY that item — checked
  // immediately before deleting, not just on the confirmation page load, so
  // a stale or mismatched itemSlug/id pair can never delete a different
  // item's source.
  const item = await prisma.item.findUnique({ where: { slug: itemSlug } });

  if (!item) {
    redirect("/admin/items?error=missing_item");
  }

  const existing = await prisma.acquisitionSource.findUnique({
    where: { id },
  });

  if (!existing || existing.itemId !== item.id) {
    redirect(`${sourcesPath}?error=missing_source`);
  }

  try {
    await prisma.acquisitionSource.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect(`${sourcesPath}?error=missing_source`);
    }
    throw error;
  }

  revalidatePath(sourcesPath);
  revalidatePath(`/items/${itemSlug}`);

  redirect(`${sourcesPath}?success=deleted`);
}
