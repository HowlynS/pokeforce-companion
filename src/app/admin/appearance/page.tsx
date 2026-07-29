import { ImageIcon, Mountain, Palette } from "lucide-react";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  DEFAULT_SITE_APPEARANCE,
  SITE_APPEARANCE_ID,
  resolveSiteAppearance,
} from "@/lib/appearance/defaults";
import { getImagePublicUrl } from "@/lib/storage/images";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { AppearanceAssetField } from "@/components/admin/appearance-asset-field";
import { AppearanceRestoreDefaults } from "@/components/admin/appearance-restore-defaults";
import { saveAppearanceAction } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  missing_asset: "Choose an appearance file before saving.",
  asset_too_large: "One of the selected files exceeds its size limit.",
  invalid_asset_type: "One of the selected files has an unsupported type.",
  invalid_asset_file:
    "One of the selected files is malformed or does not match its declared type.",
  invalid_asset_dimensions:
    "One of the selected files is outside the allowed image dimensions.",
  conflicting_asset_input:
    "Choose either a replacement or removal for an asset, not both.",
  invalid_position: "Wallpaper positions must be between 0 and 100.",
  upload_failed: "The appearance asset upload failed. Your published site is unchanged.",
};

type AppearancePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AppearancePage({
  searchParams,
}: AppearancePageProps) {
  await requireAdminUser();
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Appearance could not be saved." : null;
  const record = await prisma.siteAppearance.findUnique({
    where: { id: SITE_APPEARANCE_ID },
  });
  const appearance = await resolveSiteAppearance(record, getImagePublicUrl);

  return (
    <form
      action={saveAppearanceAction}
      className="appearance-workspace"
      key={record?.updatedAt.toISOString() ?? "appearance-defaults"}
    >
      <EditorHeader
        eyebrow="Public site"
        title="Appearance"
        subtitle="Manage brand assets and scenic composition without changing repository files."
        actions={<AppearanceRestoreDefaults />}
      />

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="admin-editor-sections appearance-editor-sections">
        <EditorSection
          title="Branding"
          icon={Palette}
          description="The shared header identity and browser icon."
        >
          <div className="appearance-asset-stack">
            <AppearanceAssetField
              name="headerLogo"
              label="Header logo"
              description="Shown once in the shared public header and linked to the homepage."
              currentUrl={appearance.headerLogo.url}
              currentWidth={appearance.headerLogo.width}
              currentHeight={appearance.headerLogo.height}
              custom={Boolean(record?.headerLogoPath)}
              defaultUrl={DEFAULT_SITE_APPEARANCE.headerLogo.url}
              accept="image/png,image/jpeg,image/webp"
              helper="PNG, JPEG, or WebP · 32–4096px per side · max 5 MB. Proportions are always preserved."
            />

            <AppearanceAssetField
              name="favicon"
              label="Favicon"
              description="Used by browser tabs and site metadata after publication."
              currentUrl={appearance.favicon.url}
              currentWidth={appearance.favicon.width}
              currentHeight={appearance.favicon.height}
              custom={Boolean(record?.faviconPath)}
              defaultUrl={DEFAULT_SITE_APPEARANCE.favicon.url}
              accept="image/png,image/x-icon,image/vnd.microsoft.icon,.ico"
              helper="PNG or ICO · 16–512px per side · max 1 MB."
            />
          </div>
        </EditorSection>

        <EditorSection
          title="Scenic backgrounds"
          icon={Mountain}
          description="Independent wallpapers for the three approved scenic public surfaces."
        >
          <div className="appearance-asset-stack">
            <AppearanceAssetField
              name="homeBackground"
              label="Homepage"
              description="The stronger scenic view behind the homepage introduction."
              currentUrl={appearance.home.background.url}
              currentWidth={appearance.home.background.width}
              currentHeight={appearance.home.background.height}
              custom={Boolean(record?.homeBackgroundPath)}
              defaultUrl={DEFAULT_SITE_APPEARANCE.home.background.url}
              accept="image/png,image/jpeg,image/webp"
              helper="PNG, JPEG, or WebP · 640–8192px per side · max 10 MB."
              fit="cover"
            />

            <AppearanceAssetField
              name="catalogueBackground"
              label="Items catalogue"
              description="The restrained scenic view behind the Items catalogue header."
              currentUrl={appearance.catalogue.background.url}
              currentWidth={appearance.catalogue.background.width}
              currentHeight={appearance.catalogue.background.height}
              custom={Boolean(record?.catalogueBackgroundPath)}
              defaultUrl={DEFAULT_SITE_APPEARANCE.catalogue.background.url}
              accept="image/png,image/jpeg,image/webp"
              helper="PNG, JPEG, or WebP · 640–8192px per side · max 10 MB."
              fit="cover"
            />

            <AppearanceAssetField
              name="itemDetailBackground"
              label="Item detail"
              description="The wallpaper beneath the existing cool-blue Item atmosphere."
              currentUrl={appearance.itemDetail.background.url}
              currentWidth={appearance.itemDetail.background.width}
              currentHeight={appearance.itemDetail.background.height}
              custom={Boolean(record?.itemDetailBackgroundPath)}
              defaultUrl={DEFAULT_SITE_APPEARANCE.itemDetail.background.url}
              accept="image/png,image/jpeg,image/webp"
              helper="PNG, JPEG, or WebP · 640–8192px per side · max 10 MB."
              fit="cover"
            />
          </div>
        </EditorSection>

        <EditorSection
          title="Publishing"
          icon={ImageIcon}
          description="The complete appearance draft publishes atomically."
        >
          <p className="text-muted appearance-publishing-note">
            Uploads remain private to this draft until Save. Replaced custom
            files are cleaned only after the new configuration is published.
            Committed fallback assets are never deleted.
          </p>
        </EditorSection>
      </div>

      {(
        [
          ["homeDesktopPositionX", appearance.home.desktop.x],
          ["homeDesktopPositionY", appearance.home.desktop.y],
          ["homeMobilePositionX", appearance.home.mobile.x],
          ["homeMobilePositionY", appearance.home.mobile.y],
          ["catalogueDesktopPositionX", appearance.catalogue.desktop.x],
          ["catalogueDesktopPositionY", appearance.catalogue.desktop.y],
          ["catalogueMobilePositionX", appearance.catalogue.mobile.x],
          ["catalogueMobilePositionY", appearance.catalogue.mobile.y],
          ["itemDetailDesktopPositionX", appearance.itemDetail.desktop.x],
          ["itemDetailDesktopPositionY", appearance.itemDetail.desktop.y],
          ["itemDetailMobilePositionX", appearance.itemDetail.mobile.x],
          ["itemDetailMobilePositionY", appearance.itemDetail.mobile.y],
        ] as const
      ).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <AdminFormGuard
        submitLabel="Save Appearance"
        cancelHref="/admin"
        draftKey="appearance:site:appearance-form"
        serverUpdatedAt={record?.updatedAt.toISOString() ?? null}
      />
    </form>
  );
}
