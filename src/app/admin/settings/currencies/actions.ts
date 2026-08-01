"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CURRENCY_LIST_PATH,
  currencyCanDelete,
} from "@/lib/admin/currency-workspace";
import { isCurrencyNameTaken } from "@/lib/admin/record-name";
import { requirePermission } from "@/lib/auth/authorization";
import { requireContentMutation } from "@/lib/auth/content-authorization";
import { prisma } from "@/lib/db";
import { resolveVerificationStamp } from "@/lib/game-versions";
import {
  isForeignKeyError,
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import {
  deleteImage,
  uploadImage,
  validateImageFile,
} from "@/lib/storage/images";
import { parseCurrencyInput } from "@/lib/validation/currency";
import { toPrismaRichDescription } from "@/lib/rich-text-prisma";

function getSubmittedImageFile(formData: FormData): File | null {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 ? value : null;
}

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

export async function createCurrencyAction(formData: FormData) {
  await requireContentMutation(formData, "content.create");
  const parsed = parseCurrencyInput(formData);

  if (!parsed.ok) {
    redirect(`${CURRENCY_LIST_PATH}/new?error=${parsed.error}`);
  }

  if (await isCurrencyNameTaken(prisma, parsed.value.name)) {
    redirect(`${CURRENCY_LIST_PATH}/new?error=duplicate_name`);
  }

  const verification = await resolveVerificationStamp(prisma, formData);
  if (verification.failed) {
    redirect(`${CURRENCY_LIST_PATH}/new?error=${verification.error}`);
  }

  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const validation = validateImageFile(imageFile);
    if (!validation.ok) {
      redirect(`${CURRENCY_LIST_PATH}/new?error=${validation.error}`);
    }
    try {
      imagePath = await uploadImage("currencies", imageFile);
    } catch {
      redirect(`${CURRENCY_LIST_PATH}/new?error=upload_failed`);
    }
  }

  let currency;

  try {
    currency = await prisma.currency.create({
      data: {
        ...toPrismaRichDescription(parsed.value),
        image: imagePath,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    await tryDeleteImage(imagePath);
    if (isUniqueConstraintError(error)) {
      redirect(`${CURRENCY_LIST_PATH}/new?error=duplicate`);
    }
    throw error;
  }

  revalidatePath(CURRENCY_LIST_PATH);
  redirect(
    `${CURRENCY_LIST_PATH}/${currency.slug}/edit?success=currency_created`
  );
}

export async function updateCurrencyAction(formData: FormData) {
  await requireContentMutation(formData, "content.edit");
  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug
    ? `${CURRENCY_LIST_PATH}/${originalSlug}/edit`
    : CURRENCY_LIST_PATH;

  if (!id) {
    redirect(`${CURRENCY_LIST_PATH}?error=missing_currency`);
  }

  const parsed = parseCurrencyInput(formData);
  if (!parsed.ok) {
    redirect(`${editPath}?error=${parsed.error}`);
  }

  const existing = await prisma.currency.findUnique({ where: { id } });
  if (!existing) {
    redirect(`${CURRENCY_LIST_PATH}?error=missing_currency`);
  }

  if (await isCurrencyNameTaken(prisma, parsed.value.name, id)) {
    redirect(`${editPath}?error=duplicate_name`);
  }

  const verification = await resolveVerificationStamp(prisma, formData);
  if (verification.failed) {
    redirect(`${editPath}?error=${verification.error}`);
  }

  const imageFile = getSubmittedImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";
  if (imageFile && removeImage) {
    redirect(`${editPath}?error=conflicting_image_input`);
  }

  let newImagePath: string | null = null;
  if (imageFile) {
    const validation = validateImageFile(imageFile);
    if (!validation.ok) {
      redirect(`${editPath}?error=${validation.error}`);
    }
    try {
      newImagePath = await uploadImage("currencies", imageFile);
    } catch {
      redirect(`${editPath}?error=upload_failed`);
    }
  }

  const image = newImagePath ?? (removeImage ? null : existing.image);

  try {
    await prisma.currency.update({
      where: { id },
      data: {
        ...toPrismaRichDescription(parsed.value),
        image,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    await tryDeleteImage(newImagePath);
    if (isUniqueConstraintError(error)) {
      redirect(`${editPath}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect(`${CURRENCY_LIST_PATH}?error=missing_currency`);
    }
    throw error;
  }

  let cleanupFailed = false;
  if ((newImagePath || removeImage) && existing.image) {
    cleanupFailed = !(await tryDeleteImage(existing.image));
  }

  revalidatePath(CURRENCY_LIST_PATH);
  revalidatePath(editPath);
  revalidatePath("/shops");
  revalidatePath("/items");

  const destination = `${CURRENCY_LIST_PATH}/${parsed.value.slug}/edit`;
  redirect(
    cleanupFailed
      ? `${destination}?success=currency_saved_image_cleanup`
      : `${destination}?success=currency_saved`
  );
}

export async function deleteCurrencyAction(formData: FormData) {
  await requirePermission("content.delete");
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect(`${CURRENCY_LIST_PATH}?error=missing_currency`);
  }

  const currency = await prisma.currency.findUnique({
    where: { id },
    include: { _count: { select: { shopListings: true } } },
  });

  if (!currency) {
    redirect(`${CURRENCY_LIST_PATH}?error=missing_currency`);
  }

  if (!currencyCanDelete(currency._count.shopListings)) {
    redirect(
      `${CURRENCY_LIST_PATH}/${currency.slug}/edit?error=linked_shop_listings`
    );
  }

  try {
    await prisma.currency.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect(`${CURRENCY_LIST_PATH}?error=missing_currency`);
    }
    if (isForeignKeyError(error)) {
      redirect(
        `${CURRENCY_LIST_PATH}/${currency.slug}/edit?error=linked_shop_listings`
      );
    }
    throw error;
  }

  const cleanupFailed = !(await tryDeleteImage(currency.image));
  revalidatePath(CURRENCY_LIST_PATH);
  revalidatePath("/shops");
  revalidatePath("/items");
  redirect(
    cleanupFailed
      ? `${CURRENCY_LIST_PATH}?success=currency_deleted_image_cleanup`
      : `${CURRENCY_LIST_PATH}?success=currency_deleted`
  );
}
