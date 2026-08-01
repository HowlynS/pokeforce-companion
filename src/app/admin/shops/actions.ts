"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isShopNameTaken } from "@/lib/admin/record-name";
import { writeContentAudit } from "@/lib/audit/content";
import {
  SHOP_LIST_PATH,
  shopCanDelete,
  shopInventoryHref,
} from "@/lib/admin/shop-workspace";
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
import { parseShopInput } from "@/lib/validation/shop";
import { toPrismaRichDescription } from "@/lib/rich-text-prisma";
import { parseShopInventoryInput } from "@/lib/validation/shop-listing";

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

function withInventoryResult(
  slug: string,
  query: string,
  kind: "error" | "success",
  code: string
): string {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  params.set(kind, code);
  return `${shopInventoryHref(slug)}?${params.toString()}`;
}

export async function createShopAction(formData: FormData) {
  const { user: actor } = await requireContentMutation(
    formData,
    "content.create"
  );
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
        ...toPrismaRichDescription(parsed.value),
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
  await writeContentAudit(prisma, {
    actor,
    operation: "create",
    targetType: "SHOP",
    targetId: shop.id,
    targetLabel: shop.name,
    formData,
  });
  redirect(`${SHOP_LIST_PATH}/${shop.slug}/edit?success=shop_created`);
}

export async function updateShopAction(formData: FormData) {
  const { user: actor } = await requireContentMutation(formData, "content.edit");
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
  await writeContentAudit(prisma, {
    actor,
    operation: "edit",
    targetType: "SHOP",
    targetId: id,
    targetLabel: parsed.value.name,
    formData,
  });
  const destination = `${SHOP_LIST_PATH}/${parsed.value.slug}/edit`;
  redirect(
    cleanupFailed
      ? `${destination}?success=shop_saved_image_cleanup`
      : `${destination}?success=shop_saved`
  );
}

export async function updateShopInventoryAction(formData: FormData) {
  const { user: actor } = await requireContentMutation(formData, "content.edit");

  const shopId = String(formData.get("shopId") ?? "").trim();
  const query = String(formData.get("q") ?? "").trim();

  if (!shopId) {
    redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      location: { select: { slug: true } },
      listings: {
        select: {
          id: true,
          item: { select: { slug: true } },
        },
      },
    },
  });
  if (!shop) {
    redirect(`${SHOP_LIST_PATH}?error=missing_shop`);
  }

  const inventoryPath = shopInventoryHref(shop.slug);
  const parsed = parseShopInventoryInput(formData);
  if (!parsed.ok) {
    redirect(
      withInventoryResult(shop.slug, query, "error", parsed.error)
    );
  }

  const submittedRowKeySet = new Set(parsed.value.rowKeys);
  const existingById = new Map(
    shop.listings.map((listing) => [listing.id, listing])
  );

  // Every existing listing rendered by this Shop must still be represented
  // by its exact stable key, including staged removals. This prevents a
  // truncated or cross-Shop form from silently replacing an incomplete set.
  const existingRowsAreComplete = shop.listings.every((listing) =>
    submittedRowKeySet.has(`existing-${listing.id}`)
  );
  const rowOwnershipIsValid = parsed.value.rows.every((row) => {
    if (row.key.startsWith("existing-")) {
      return (
        row.listingId !== null &&
        row.key === `existing-${row.listingId}` &&
        existingById.has(row.listingId)
      );
    }
    return row.listingId === null;
  });

  if (!existingRowsAreComplete || !rowOwnershipIsValid) {
    redirect(
      withInventoryResult(shop.slug, query, "error", "invalid_listing")
    );
  }

  const itemIds = [...new Set(parsed.value.rows.map((row) => row.itemId))];
  const currencyIds = [
    ...new Set(parsed.value.rows.map((row) => row.currencyId)),
  ];
  const [items, currencies] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, slug: true },
    }),
    prisma.currency.findMany({
      where: { id: { in: currencyIds } },
      select: { id: true },
    }),
  ]);

  if (items.length !== itemIds.length) {
    redirect(
      withInventoryResult(shop.slug, query, "error", "invalid_item")
    );
  }
  if (currencies.length !== currencyIds.length) {
    redirect(
      withInventoryResult(shop.slug, query, "error", "invalid_currency")
    );
  }

  const rowsWithVerification: Array<
    (typeof parsed.value.rows)[number] & {
      verification: {
        verifiedAt: Date;
        verifiedGameVersionId: string;
      } | null;
    }
  > = [];
  for (const row of parsed.value.rows) {
    const verification = await resolveVerificationStamp(
      prisma,
      formData,
      `${row.key}.`
    );
    if (verification.failed) {
      redirect(
        withInventoryResult(shop.slug, query, "error", verification.error)
      );
    }
    rowsWithVerification.push({ ...row, verification: verification.stamp });
  }

  const retainedIds = new Set(
    rowsWithVerification.flatMap((row) =>
      row.listingId ? [row.listingId] : []
    )
  );
  const removedIds = shop.listings
    .map((listing) => listing.id)
    .filter((id) => !retainedIds.has(id));

  try {
    await prisma.$transaction(async (tx) => {
      if (removedIds.length > 0) {
        await tx.shopListing.deleteMany({
          where: { shopId: shop.id, id: { in: removedIds } },
        });
      }

      for (const row of rowsWithVerification) {
        const data = {
          itemId: row.itemId,
          currencyId: row.currencyId,
          priceAmount: row.priceAmount,
          notes: row.notes,
          ...(row.verification ?? {}),
        };
        if (row.listingId) {
          await tx.shopListing.update({
            where: { id: row.listingId, shopId: shop.id },
            data,
          });
        } else {
          await tx.shopListing.create({
            data: { shopId: shop.id, ...data },
          });
        }
      }

      // Inventory is part of the Shop's authored content. Bumping updatedAt
      // in the same transaction gives AdminFormGuard a new, authoritative
      // draft baseline after the save-in-place redirect.
      await tx.shop.update({
        where: { id: shop.id },
        data: { updatedAt: new Date() },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect(
        withInventoryResult(shop.slug, query, "error", "duplicate_listing")
      );
    }
    if (isMissingRecordError(error) || isForeignKeyError(error)) {
      redirect(
        withInventoryResult(shop.slug, query, "error", "relation_changed")
      );
    }
    throw error;
  }

  revalidatePath(SHOP_LIST_PATH);
  revalidatePath(inventoryPath);
  revalidatePath(`/shops/${shop.slug}`);
  revalidatePath(`/locations/${shop.location.slug}`);

  const itemSlugs = new Set([
    ...shop.listings.map((listing) => listing.item.slug),
    ...items.map((item) => item.slug),
  ]);
  for (const itemSlug of itemSlugs) {
    revalidatePath(`/items/${itemSlug}`);
  }
  await writeContentAudit(prisma, {
    actor,
    operation: "edit",
    targetType: "SHOP",
    targetId: shop.id,
    targetLabel: shop.name,
    formData,
    changedArea: "inventory",
  });

  redirect(
    withInventoryResult(
      shop.slug,
      query,
      "success",
      "shop_inventory_saved"
    )
  );
}

export async function deleteShopAction(formData: FormData) {
  const { user: actor } = await requirePermission("content.delete");
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
  await writeContentAudit(prisma, {
    actor,
    operation: "delete",
    targetType: "SHOP",
    targetId: shop.id,
    targetLabel: shop.name,
  });
  redirect(
    cleanupFailed
      ? `${SHOP_LIST_PATH}?success=shop_deleted_image_cleanup`
      : `${SHOP_LIST_PATH}?success=shop_deleted`
  );
}
