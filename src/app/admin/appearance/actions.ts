"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  DEFAULT_SITE_APPEARANCE,
  SITE_APPEARANCE_CACHE_TAG,
  SITE_APPEARANCE_ID,
} from "@/lib/appearance/defaults";
import {
  publishSiteAppearance,
  type SiteAppearanceWrite,
} from "@/lib/appearance/service";
import {
  deleteAppearanceAsset,
  uploadAppearanceAsset,
  validateAppearanceAsset,
  type AppearanceAssetKind,
} from "@/lib/storage/appearance-assets";

type AssetConfig = {
  formName: string;
  kind: AppearanceAssetKind;
  pathKey: keyof Pick<
    SiteAppearanceWrite,
    | "headerLogoPath"
    | "faviconPath"
    | "homeBackgroundPath"
    | "catalogueBackgroundPath"
    | "itemDetailBackgroundPath"
  >;
  widthKey: keyof Pick<
    SiteAppearanceWrite,
    | "headerLogoWidth"
    | "faviconWidth"
    | "homeBackgroundWidth"
    | "catalogueBackgroundWidth"
    | "itemDetailBackgroundWidth"
  >;
  heightKey: keyof Pick<
    SiteAppearanceWrite,
    | "headerLogoHeight"
    | "faviconHeight"
    | "homeBackgroundHeight"
    | "catalogueBackgroundHeight"
    | "itemDetailBackgroundHeight"
  >;
};

const ASSETS: readonly AssetConfig[] = [
  {
    formName: "headerLogo",
    kind: "header-logo",
    pathKey: "headerLogoPath",
    widthKey: "headerLogoWidth",
    heightKey: "headerLogoHeight",
  },
  {
    formName: "favicon",
    kind: "favicon",
    pathKey: "faviconPath",
    widthKey: "faviconWidth",
    heightKey: "faviconHeight",
  },
  {
    formName: "homeBackground",
    kind: "home-background",
    pathKey: "homeBackgroundPath",
    widthKey: "homeBackgroundWidth",
    heightKey: "homeBackgroundHeight",
  },
  {
    formName: "catalogueBackground",
    kind: "catalogue-background",
    pathKey: "catalogueBackgroundPath",
    widthKey: "catalogueBackgroundWidth",
    heightKey: "catalogueBackgroundHeight",
  },
  {
    formName: "itemDetailBackground",
    kind: "item-detail-background",
    pathKey: "itemDetailBackgroundPath",
    widthKey: "itemDetailBackgroundWidth",
    heightKey: "itemDetailBackgroundHeight",
  },
] as const;

function submittedFile(formData: FormData, name: string): File | null {
  const value = formData.get(`${name}File`);
  return value instanceof File && value.size > 0 ? value : null;
}

function positionValue(
  formData: FormData,
  name: string,
  fallback: number
): number | null {
  const raw = formData.get(name);
  if (raw === null || String(raw).trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

async function cleanupAssets(paths: readonly (string | null | undefined)[]) {
  let failed = false;
  for (const path of new Set(paths.filter((value): value is string => Boolean(value)))) {
    try {
      await deleteAppearanceAsset(path);
    } catch (error) {
      failed = true;
      console.error(
        `Failed to clean appearance asset "${path}":`,
        error instanceof Error ? error.message : "unknown error"
      );
    }
  }
  return !failed;
}

export async function saveAppearanceAction(formData: FormData) {
  await requireAdminUser();

  const existing = await prisma.siteAppearance.findUnique({
    where: { id: SITE_APPEARANCE_ID },
  });
  const restoreAll = formData.get("restoreAll") === "on";

  const positions = {
    homeDesktopPositionX: positionValue(
      formData,
      "homeDesktopPositionX",
      existing?.homeDesktopPositionX ?? DEFAULT_SITE_APPEARANCE.home.desktop.x
    ),
    homeDesktopPositionY: positionValue(
      formData,
      "homeDesktopPositionY",
      existing?.homeDesktopPositionY ?? DEFAULT_SITE_APPEARANCE.home.desktop.y
    ),
    homeMobilePositionX: positionValue(
      formData,
      "homeMobilePositionX",
      existing?.homeMobilePositionX ?? DEFAULT_SITE_APPEARANCE.home.mobile.x
    ),
    homeMobilePositionY: positionValue(
      formData,
      "homeMobilePositionY",
      existing?.homeMobilePositionY ?? DEFAULT_SITE_APPEARANCE.home.mobile.y
    ),
    catalogueDesktopPositionX: positionValue(
      formData,
      "catalogueDesktopPositionX",
      existing?.catalogueDesktopPositionX ??
        DEFAULT_SITE_APPEARANCE.catalogue.desktop.x
    ),
    catalogueDesktopPositionY: positionValue(
      formData,
      "catalogueDesktopPositionY",
      existing?.catalogueDesktopPositionY ??
        DEFAULT_SITE_APPEARANCE.catalogue.desktop.y
    ),
    catalogueMobilePositionX: positionValue(
      formData,
      "catalogueMobilePositionX",
      existing?.catalogueMobilePositionX ??
        DEFAULT_SITE_APPEARANCE.catalogue.mobile.x
    ),
    catalogueMobilePositionY: positionValue(
      formData,
      "catalogueMobilePositionY",
      existing?.catalogueMobilePositionY ??
        DEFAULT_SITE_APPEARANCE.catalogue.mobile.y
    ),
    itemDetailDesktopPositionX: positionValue(
      formData,
      "itemDetailDesktopPositionX",
      existing?.itemDetailDesktopPositionX ??
        DEFAULT_SITE_APPEARANCE.itemDetail.desktop.x
    ),
    itemDetailDesktopPositionY: positionValue(
      formData,
      "itemDetailDesktopPositionY",
      existing?.itemDetailDesktopPositionY ??
        DEFAULT_SITE_APPEARANCE.itemDetail.desktop.y
    ),
    itemDetailMobilePositionX: positionValue(
      formData,
      "itemDetailMobilePositionX",
      existing?.itemDetailMobilePositionX ??
        DEFAULT_SITE_APPEARANCE.itemDetail.mobile.x
    ),
    itemDetailMobilePositionY: positionValue(
      formData,
      "itemDetailMobilePositionY",
      existing?.itemDetailMobilePositionY ??
        DEFAULT_SITE_APPEARANCE.itemDetail.mobile.y
    ),
  };
  if (!restoreAll && Object.values(positions).some((value) => value === null)) {
    redirect("/admin/appearance?error=invalid_position");
  }

  const files = new Map<string, File>();
  for (const asset of ASSETS) {
    const file = submittedFile(formData, asset.formName);
    const remove = formData.get(`${asset.formName}Intent`) === "remove";
    if (file && remove) {
      redirect("/admin/appearance?error=conflicting_asset_input");
    }
    if (!file || restoreAll) {
      continue;
    }
    const validation = await validateAppearanceAsset(file, asset.kind);
    if (!validation.ok) {
      redirect(`/admin/appearance?error=${validation.error}`);
    }
    files.set(asset.formName, file);
  }

  const value: SiteAppearanceWrite = {
    headerLogoPath: existing?.headerLogoPath ?? null,
    headerLogoWidth: existing?.headerLogoWidth ?? null,
    headerLogoHeight: existing?.headerLogoHeight ?? null,
    faviconPath: existing?.faviconPath ?? null,
    faviconWidth: existing?.faviconWidth ?? null,
    faviconHeight: existing?.faviconHeight ?? null,
    homeBackgroundPath: existing?.homeBackgroundPath ?? null,
    homeBackgroundWidth: existing?.homeBackgroundWidth ?? null,
    homeBackgroundHeight: existing?.homeBackgroundHeight ?? null,
    catalogueBackgroundPath: existing?.catalogueBackgroundPath ?? null,
    catalogueBackgroundWidth: existing?.catalogueBackgroundWidth ?? null,
    catalogueBackgroundHeight: existing?.catalogueBackgroundHeight ?? null,
    itemDetailBackgroundPath: existing?.itemDetailBackgroundPath ?? null,
    itemDetailBackgroundWidth: existing?.itemDetailBackgroundWidth ?? null,
    itemDetailBackgroundHeight: existing?.itemDetailBackgroundHeight ?? null,
    ...(restoreAll
      ? {
          homeDesktopPositionX: DEFAULT_SITE_APPEARANCE.home.desktop.x,
          homeDesktopPositionY: DEFAULT_SITE_APPEARANCE.home.desktop.y,
          homeMobilePositionX: DEFAULT_SITE_APPEARANCE.home.mobile.x,
          homeMobilePositionY: DEFAULT_SITE_APPEARANCE.home.mobile.y,
          catalogueDesktopPositionX:
            DEFAULT_SITE_APPEARANCE.catalogue.desktop.x,
          catalogueDesktopPositionY:
            DEFAULT_SITE_APPEARANCE.catalogue.desktop.y,
          catalogueMobilePositionX: DEFAULT_SITE_APPEARANCE.catalogue.mobile.x,
          catalogueMobilePositionY: DEFAULT_SITE_APPEARANCE.catalogue.mobile.y,
          itemDetailDesktopPositionX:
            DEFAULT_SITE_APPEARANCE.itemDetail.desktop.x,
          itemDetailDesktopPositionY:
            DEFAULT_SITE_APPEARANCE.itemDetail.desktop.y,
          itemDetailMobilePositionX:
            DEFAULT_SITE_APPEARANCE.itemDetail.mobile.x,
          itemDetailMobilePositionY:
            DEFAULT_SITE_APPEARANCE.itemDetail.mobile.y,
        }
      : (positions as Omit<
          SiteAppearanceWrite,
          | "headerLogoPath"
          | "headerLogoWidth"
          | "headerLogoHeight"
          | "faviconPath"
          | "faviconWidth"
          | "faviconHeight"
          | "homeBackgroundPath"
          | "homeBackgroundWidth"
          | "homeBackgroundHeight"
          | "catalogueBackgroundPath"
          | "catalogueBackgroundWidth"
          | "catalogueBackgroundHeight"
          | "itemDetailBackgroundPath"
          | "itemDetailBackgroundWidth"
          | "itemDetailBackgroundHeight"
        >)),
  };

  const uploadedPaths: string[] = [];
  try {
    for (const asset of ASSETS) {
      if (restoreAll) {
        value[asset.pathKey] = null;
        value[asset.widthKey] = null;
        value[asset.heightKey] = null;
        continue;
      }
      const file = files.get(asset.formName);
      const remove = formData.get(`${asset.formName}Intent`) === "remove";
      if (file) {
        const uploaded = await uploadAppearanceAsset(asset.kind, file);
        uploadedPaths.push(uploaded.path);
        value[asset.pathKey] = uploaded.path;
        value[asset.widthKey] = uploaded.width;
        value[asset.heightKey] = uploaded.height;
      } else if (remove) {
        value[asset.pathKey] = null;
        value[asset.widthKey] = null;
        value[asset.heightKey] = null;
      }
    }
  } catch {
    await cleanupAssets(uploadedPaths);
    redirect("/admin/appearance?error=upload_failed");
  }

  try {
    await publishSiteAppearance(prisma, value);
  } catch (error) {
    await cleanupAssets(uploadedPaths);
    throw error;
  }

  const oldPathsToClean = ASSETS.flatMap((asset) => {
    const oldPath = existing?.[asset.pathKey] ?? null;
    return oldPath && oldPath !== value[asset.pathKey] ? [oldPath] : [];
  });
  const cleanupSucceeded = await cleanupAssets(oldPathsToClean);

  updateTag(SITE_APPEARANCE_CACHE_TAG);
  for (const path of [
    "/",
    "/items",
    "/admin/appearance",
  ]) {
    revalidatePath(path);
  }
  if (existing?.itemDetailBackgroundPath !== value.itemDetailBackgroundPath) {
    revalidatePath("/items/[slug]", "page");
  }

  redirect(
    cleanupSucceeded
      ? "/admin/appearance?success=appearance_saved"
      : "/admin/appearance?success=appearance_saved_asset_cleanup"
  );
}
