export const SITE_APPEARANCE_ID = "site";
export const SITE_APPEARANCE_CACHE_TAG = "site-appearance";

export type AppearanceAsset = {
  url: string | null;
  width: number | null;
  height: number | null;
  custom: boolean;
};

export type ScenicPosition = {
  x: number;
  y: number;
};

export type ScenicAppearance = {
  background: AppearanceAsset;
  desktop: ScenicPosition;
  mobile: ScenicPosition;
};

export type ResolvedSiteAppearance = {
  headerLogo: AppearanceAsset;
  favicon: AppearanceAsset;
  home: ScenicAppearance;
  catalogue: ScenicAppearance;
  itemDetail: ScenicAppearance;
  version: string;
};

export const DEFAULT_HEADER_LOGO_URL =
  "/images/branding/merchants-codex-logo.png";
export const DEFAULT_HEADER_LOGO_WIDTH = 1394;
export const DEFAULT_HEADER_LOGO_HEIGHT = 486;

export const DEFAULT_SITE_APPEARANCE: ResolvedSiteAppearance = {
  headerLogo: {
    url: DEFAULT_HEADER_LOGO_URL,
    width: DEFAULT_HEADER_LOGO_WIDTH,
    height: DEFAULT_HEADER_LOGO_HEIGHT,
    custom: false,
  },
  // No favicon is committed in the current design. A null URL deliberately
  // leaves favicon handling to the browser until an admin publishes one.
  favicon: {
    url: null,
    width: null,
    height: null,
    custom: false,
  },
  home: {
    background: {
      url: "/images/backgrounds/merchants-codex-coastal-overlook.png",
      width: null,
      height: null,
      custom: false,
    },
    desktop: { x: 55, y: 50 },
    mobile: { x: 82, y: 50 },
  },
  catalogue: {
    background: {
      url: "/images/backgrounds/merchants-codex-coastal-overlook.png",
      width: null,
      height: null,
      custom: false,
    },
    desktop: { x: 55, y: 60 },
    mobile: { x: 82, y: 50 },
  },
  itemDetail: {
    background: {
      url: "/images/backgrounds/merchants-codex-coastal-overlook.png",
      width: null,
      height: null,
      custom: false,
    },
    desktop: { x: 55, y: 50 },
    mobile: { x: 82, y: 50 },
  },
  version: "default",
};

export type SiteAppearanceRecord = {
  id?: unknown;
  headerLogoPath?: unknown;
  headerLogoWidth?: unknown;
  headerLogoHeight?: unknown;
  faviconPath?: unknown;
  faviconWidth?: unknown;
  faviconHeight?: unknown;
  homeBackgroundPath?: unknown;
  homeBackgroundWidth?: unknown;
  homeBackgroundHeight?: unknown;
  homeDesktopPositionX?: unknown;
  homeDesktopPositionY?: unknown;
  homeMobilePositionX?: unknown;
  homeMobilePositionY?: unknown;
  catalogueBackgroundPath?: unknown;
  catalogueBackgroundWidth?: unknown;
  catalogueBackgroundHeight?: unknown;
  catalogueDesktopPositionX?: unknown;
  catalogueDesktopPositionY?: unknown;
  catalogueMobilePositionX?: unknown;
  catalogueMobilePositionY?: unknown;
  itemDetailBackgroundPath?: unknown;
  itemDetailBackgroundWidth?: unknown;
  itemDetailBackgroundHeight?: unknown;
  itemDetailDesktopPositionX?: unknown;
  itemDetailDesktopPositionY?: unknown;
  itemDetailMobilePositionX?: unknown;
  itemDetailMobilePositionY?: unknown;
  updatedAt?: unknown;
};

export function clampAppearancePercentage(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : fallback;
}

function positiveDimension(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 16384
    ? value
    : null;
}

function objectPath(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function versionFrom(value: unknown): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;
  return date && Number.isFinite(date.getTime())
    ? String(date.getTime())
    : "default";
}

export function withAppearanceCacheVersion(url: string, version: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

type PublicUrlResolver = (objectPath: string) => Promise<string | null>;

async function resolveAsset(
  pathValue: unknown,
  widthValue: unknown,
  heightValue: unknown,
  fallback: AppearanceAsset,
  version: string,
  publicUrlForPath: PublicUrlResolver,
  dimensionsRequired: boolean
): Promise<AppearanceAsset> {
  const path = objectPath(pathValue);
  if (!path) {
    return fallback;
  }

  const width = positiveDimension(widthValue);
  const height = positiveDimension(heightValue);
  if (dimensionsRequired && (!width || !height)) {
    return fallback;
  }

  try {
    const url = await publicUrlForPath(path);
    if (!url) {
      return fallback;
    }
    return {
      url: withAppearanceCacheVersion(url, version),
      width,
      height,
      custom: true,
    };
  } catch {
    return fallback;
  }
}

export async function resolveSiteAppearance(
  record: SiteAppearanceRecord | null | undefined,
  publicUrlForPath: PublicUrlResolver
): Promise<ResolvedSiteAppearance> {
  if (!record || record.id !== SITE_APPEARANCE_ID) {
    return DEFAULT_SITE_APPEARANCE;
  }

  const version = versionFrom(record.updatedAt);
  const [headerLogo, favicon, homeBackground, catalogueBackground, itemDetailBackground] =
    await Promise.all([
      resolveAsset(
        record.headerLogoPath,
        record.headerLogoWidth,
        record.headerLogoHeight,
        DEFAULT_SITE_APPEARANCE.headerLogo,
        version,
        publicUrlForPath,
        true
      ),
      resolveAsset(
        record.faviconPath,
        record.faviconWidth,
        record.faviconHeight,
        DEFAULT_SITE_APPEARANCE.favicon,
        version,
        publicUrlForPath,
        false
      ),
      resolveAsset(
        record.homeBackgroundPath,
        record.homeBackgroundWidth,
        record.homeBackgroundHeight,
        DEFAULT_SITE_APPEARANCE.home.background,
        version,
        publicUrlForPath,
        false
      ),
      resolveAsset(
        record.catalogueBackgroundPath,
        record.catalogueBackgroundWidth,
        record.catalogueBackgroundHeight,
        DEFAULT_SITE_APPEARANCE.catalogue.background,
        version,
        publicUrlForPath,
        false
      ),
      resolveAsset(
        record.itemDetailBackgroundPath,
        record.itemDetailBackgroundWidth,
        record.itemDetailBackgroundHeight,
        DEFAULT_SITE_APPEARANCE.itemDetail.background,
        version,
        publicUrlForPath,
        false
      ),
    ]);

  const scenic = (
    background: AppearanceAsset,
    defaults: ScenicAppearance,
    desktopX: unknown,
    desktopY: unknown,
    mobileX: unknown,
    mobileY: unknown
  ): ScenicAppearance => ({
    background,
    desktop: {
      x: clampAppearancePercentage(desktopX, defaults.desktop.x),
      y: clampAppearancePercentage(desktopY, defaults.desktop.y),
    },
    mobile: {
      x: clampAppearancePercentage(mobileX, defaults.mobile.x),
      y: clampAppearancePercentage(mobileY, defaults.mobile.y),
    },
  });

  return {
    headerLogo,
    favicon,
    home: scenic(
      homeBackground,
      DEFAULT_SITE_APPEARANCE.home,
      record.homeDesktopPositionX,
      record.homeDesktopPositionY,
      record.homeMobilePositionX,
      record.homeMobilePositionY
    ),
    catalogue: scenic(
      catalogueBackground,
      DEFAULT_SITE_APPEARANCE.catalogue,
      record.catalogueDesktopPositionX,
      record.catalogueDesktopPositionY,
      record.catalogueMobilePositionX,
      record.catalogueMobilePositionY
    ),
    itemDetail: scenic(
      itemDetailBackground,
      DEFAULT_SITE_APPEARANCE.itemDetail,
      record.itemDetailDesktopPositionX,
      record.itemDetailDesktopPositionY,
      record.itemDetailMobilePositionX,
      record.itemDetailMobilePositionY
    ),
    version,
  };
}
