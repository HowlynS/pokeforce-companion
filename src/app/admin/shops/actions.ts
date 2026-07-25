"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isShopNameTaken } from "@/lib/admin/record-name";
import { SHOP_LIST_PATH, shopCanDelete } from "@/lib/admin/shop-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
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
import { parseShopInput } from "@/lib/validation/shop";

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

export async function createShopAction(formData: FormData) {
  await requireAdminUser();
  const parsed = parseShopInput(formData);
  if (!parsed.ok) {
    redirect(`${SHOP_LIST_PATH}/new?error=${parsed.error}`);
  }

  if (await isShopNameTaken(prisma, parsed.value.name)) {
    redirect(`${SHOP_LIST_PATH}/new?error=duplicate_name`);
  }

  const location = await prisma.location.findUnique({
    where: { id: parsed.value.locationId },
    select: { id: true },
  });
  if (!location) {
    redirect(`${SHOP_LIST_PATH}/new?error=invalid_location`);
  }

  const verification = await resolveVerificationStamp(prisma, formData);
  if (verification.failed) {
    redirect(`${SHOP_LIST_PATH}/new?error=${verification.error}`);
  }

  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;
  if (imageFile) {
    const validation = validateImageFile(imageFile);
    if (!validation.ok) {
      redirect(`${SHOP_LIST_PATH}/new?error=${validation.error}`);
    }
    try {
      imagePath = await uploadImage("shops", imageFile);
    } catch {
      redirect(`${SHOP_LIST_PATH}/new?error=upload_failed`);
    }
  }

  let shop;
  try {
    shop = await prisma.shop.create({
      data: {
        ...parsed.value,
        image: imagePath,
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    await tryDeleteImage(imagePath);
    if (isUniqueConstraintError(error)) {
      redirect(`${SHOP_LIST_PATH}/new?error=duplicate`);
    }
    if (isForeignKeyError(error)) {
      redirect(`${SHOP_LIST_PATH}/new?error=invalid_location`);
    }
    throw error;
  }

  revalidatePath(SHOP_LIST_PATH);
  revalidatePath("/shops");
  redirect(`${SHOP_LIST_PATH}/${shop.slug}/edit?success=shop_created`);
}

export async function updateShopAction(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug
    ? `${SHOP_LIST_PATH}/${originalSlug}/edit`
    : SHOP_LIST_PATH;

  if (!id) {
    redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
  }

  const parsed = parseShopInput(formData);
  if (!parsed.ok) {
    redirect(`${editPath}?error=${parsed.error}`);
  }

  const existing = await prisma.shop.findUnique({
    where: { id },
    include: { location: { select: { slug: true } } },
  });
  if (!existing) {
    redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
  }

  if (await isShopNameTaken(prisma, parsed.value.name, id)) {
    redirect(`${editPath}?error=duplicate_name`);
  }

  const location = await prisma.location.findUnique({
    where: { id: parsed.value.locationId },
    select: { slug: true },
  });
  if (!location) {
    redirect(`${editPath}?error=invalid_location`);
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
      newImagePath = await uploadImage("shops", imageFile);
    } catch {
      redirect(`${editPath}?error=upload_failed`);
    }
  }
  const image = newImagePath ?? (removeImage ? null : existing.image);

  try {
    await prisma.shop.update({
      where: { id },
      data: {
        ...parsed.value,
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
      redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
    }
    if (isForeignKeyError(error)) {
      redirect(`${editPath}?error=invalid_location`);
    }
    throw error;
  }

  let cleanupFailed = false;
  if ((newImagePath || removeImage) && existing.image) {
    cleanupFailed = !(await tryDeleteImage(existing.image));
  }

  revalidatePath(SHOP_LIST_PATH);
  revalidatePath("/shops");
  revalidatePath(`/locations/${existing.location.slug}`);
  revalidatePath(`/locations/${location.slug}`);
  const destination = `${SHOP_LIST_PATH}/${parsed.value.slug}/edit`;
  redirect(
    cleanupFailed
      ? `${destination}?success=shop_saved_image_cleanup`
      : `${destination}?success=shop_saved`
  );
}

export async function deleteShopAction(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
  }

  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      location: { select: { slug: true } },
      _count: { select: { listings: true } },
    },
  });
  if (!shop) {
    redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
  }

  if (!shopCanDelete(shop._count.listings)) {
    redirect(`${SHOP_LIST_PATH}/${shop.slug}/edit?error=linked_listings`);
  }

  try {
    await prisma.shop.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
    }
    if (isForeignKeyError(error)) {
      redirect(`${SHOP_LIST_PATH}/${shop.slug}/edit?error=linked_listings`);
    }
    throw error;
  }

  const cleanupFailed = !(await tryDeleteImage(shop.image));
  revalidatePath(SHOP_LIST_PATH);
  revalidatePath("/shops");
  revalidatePath(`/locations/${shop.location.slug}`);
  redirect(
    cleanupFailed
      ? `${SHOP_LIST_PATH}?success=shop_deleted_image_cleanup`
      : `${SHOP_LIST_PATH}?success=shop_deleted`
  );
}
