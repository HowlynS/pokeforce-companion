import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { AdminSelect } from "@/components/admin/admin-select";
import { RichDescriptionEditor } from "@/components/admin/rich-description-editor";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { ShopWorkspace } from "@/components/admin/shop-workspace";
import { VerificationPanel } from "@/components/admin/verification-panel";
import {
  SHOP_CREATE_PATH,
  SHOP_LIST_PATH,
  buildShopLocationOptions,
  normalizeShopSearchQuery,
  withShopSearchQuery,
} from "@/lib/admin/shop-workspace";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { createShopAction } from "../actions";
import { checkShopNameAvailability } from "../name-availability";
import { checkShopSlugAvailability } from "../slug-availability";

export const dynamic = "force-dynamic";

const FORM_ID = "shop-create-form";

const errorMessages: Record<string, string> = {
  missing_name: "Shop name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  invalid_rich_description:
    "The formatted description could not be validated. Review it and try again.",
  missing_location: "Select a location.",
  invalid_location: "The selected location no longer exists.",
  duplicate: "A shop with that page address already exists.",
  duplicate_name: "A shop with that name already exists.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  no_current_version:
    "No Game Version is marked as current. Select one under Game Versions before verifying this shop.",
  invalid_game_version:
    "The selected Game Version no longer exists. Refresh and try again.",
};

type NewShopPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewShopPage({
  searchParams,
}: NewShopPageProps) {
  await requireAdminUser();
  const { q, error } = await searchParams;
  const query = normalizeShopSearchQuery(q);
  const [locations, gameVersions] = await Promise.all([
    prisma.location.findMany({
      select: { id: true, name: true, parentId: true, image: true },
    }),
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const imageUrls = await Promise.all(
    locations.map((location) => getImagePublicUrl(location.image))
  );
  const locationOptions = buildShopLocationOptions(
    locations.map((location, index) => ({
      ...location,
      imageUrl: imageUrls[index],
    }))
  );
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withShopSearchQuery(SHOP_CREATE_PATH, query),
      active: true,
    },
  ];
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  return (
    <ShopWorkspace
      rawQuery={q}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Shop"
            title="Create Shop"
            subtitle="Add a fixed in-game shop at a known location."
          />
          <EditorTabs label="Shop editor sections" tabs={tabs} />
          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={
        <>
          <ImagePanel imageUrl={null} formId={FORM_ID} />
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={null}
            verifiedGameVersion={null}
            formId={FORM_ID}
          />
        </>
      }
    >
      <div className="admin-editor-surface">
        <form
          id={FORM_ID}
          action={createShopAction}
          className="form-grid form-grid-responsive"
        >
          <div className="admin-editor-sections">
            <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
              <RecordIdentityFields
                checkNameAvailabilityAction={checkShopNameAvailability}
                nameTakenText="A shop with that name already exists."
                nameRegionId="shop-name-availability"
                checkSlugAvailabilityAction={checkShopSlugAvailability}
                slugTakenText="A shop with that page address already exists."
                slugRegionId="shop-slug-availability"
              />
            </EditorSection>

            <EditorSection title="Location" icon={SECTION_ICONS.linkedContext}>
              <label className="form-field">
                <span className="form-field-label">Location</span>
                <AdminSelect
                  name="locationId"
                  required
                  defaultValue=""
                  placeholder="Select a location"
                  options={locationOptions}
                />
              </label>
            </EditorSection>

            <EditorSection title="Content" icon={SECTION_ICONS.content}>
              <RichDescriptionEditor
                error={
                  error === "invalid_rich_description"
                    ? "The formatted description could not be validated. Review it and try again."
                    : null
                }
              />
            </EditorSection>
          </div>

          <AdminFormGuard
            submitLabel="Create Shop"
            cancelHref={withShopSearchQuery(SHOP_LIST_PATH, query)}
            excludeFields={["verifiedGameVersionId"]}
            draftKey="shop:new:shop-create-form"
          />
        </form>
      </div>
    </ShopWorkspace>
  );
}
