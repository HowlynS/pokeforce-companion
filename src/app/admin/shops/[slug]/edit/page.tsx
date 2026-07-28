import { notFound } from "next/navigation";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { AdminSelect } from "@/components/admin/admin-select";
import { RichDescriptionEditor } from "@/components/admin/rich-description-editor";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { ShopWorkspace } from "@/components/admin/shop-workspace";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import {
  SHOP_LIST_PATH,
  buildShopLocationOptions,
  describeShopListings,
  normalizeShopSearchQuery,
  shopCanDelete,
  shopEditorTabs,
  withShopSearchQuery,
} from "@/lib/admin/shop-workspace";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { deleteShopAction, updateShopAction } from "../../actions";
import { checkShopNameAvailability } from "../../name-availability";
import { checkShopSlugAvailability } from "../../slug-availability";

export const dynamic = "force-dynamic";

const FORM_ID = "shop-edit-form";

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
  linked_listings:
    "This shop cannot be deleted while inventory listings still reference it.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
  no_current_version:
    "No Game Version is marked as current. Select one under Game Versions before verifying this shop.",
  invalid_game_version:
    "The selected Game Version no longer exists. Refresh and try again.",
};

type EditShopPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditShopPage({
  params,
  searchParams,
}: EditShopPageProps) {
  await requireAdminUser();
  const { slug } = await params;
  const { q, error } = await searchParams;
  const query = normalizeShopSearchQuery(q);
  const [shop, locations, gameVersions] = await Promise.all([
    prisma.shop.findUnique({
      where: { slug },
      include: {
        verifiedGameVersion: true,
        _count: { select: { listings: true } },
      },
    }),
    prisma.location.findMany({
      select: { id: true, name: true, parentId: true, image: true },
    }),
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!shop) {
    notFound();
  }

  const [imageUrl, locationImageUrls] = await Promise.all([
    getImagePublicUrl(shop.image),
    Promise.all(
      locations.map((location) => getImagePublicUrl(location.image))
    ),
  ]);
  const locationOptions = buildShopLocationOptions(
    locations.map((location, index) => ({
      ...location,
      imageUrl: locationImageUrls[index],
    }))
  );
  const listingCount = shop._count.listings;
  const canDelete = shopCanDelete(listingCount);
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  return (
    <ShopWorkspace
      key={shop.updatedAt.toISOString()}
      rawQuery={q}
      selectedSlug={shop.slug}
      editorHeader={
        <>
          <EditorHeader eyebrow="Shop" title={shop.name} subtitle={shop.slug} />
          <EditorTabs
            label="Shop editor sections"
            tabs={shopEditorTabs(shop.slug, query, "general", listingCount)}
          />
          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={
        <>
          <ImagePanel
            imageUrl={imageUrl}
            imageAlt={`Current image for ${shop.name}`}
            formId={FORM_ID}
          />
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={shop.verifiedAt}
            verifiedGameVersion={shop.verifiedGameVersion}
            formId={FORM_ID}
          />
          <TimestampsPanel
            createdAt={shop.createdAt}
            updatedAt={shop.updatedAt}
          />
          <DangerZonePanel
            resourceLabel="shop"
            deleteLabel="Delete Shop"
            dialogTitle="Delete Shop"
            dialogDescription={
              <>
                You are about to permanently delete <strong>{shop.name}</strong>{" "}
                ({shop.slug}). This action cannot be undone.
              </>
            }
            canDelete={canDelete}
            formAction={deleteShopAction}
            hiddenFields={{ id: shop.id }}
          >
            <p className="text-muted">Inventory listings: {listingCount}</p>
            {!canDelete ? (
              <p className="text-danger">
                Remove {describeShopListings(listingCount)} before deleting
                this shop.
              </p>
            ) : null}
          </DangerZonePanel>
        </>
      }
    >
      <div className="admin-editor-surface">
        <form
          id={FORM_ID}
          action={updateShopAction}
          className="form-grid form-grid-responsive"
        >
          <input type="hidden" name="id" value={shop.id} />
          <input type="hidden" name="originalSlug" value={shop.slug} />
          <div className="admin-editor-sections">
            <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
              <RecordIdentityFields
                checkNameAvailabilityAction={checkShopNameAvailability}
                nameTakenText="A shop with that name already exists."
                nameRegionId="shop-name-availability"
                originalName={shop.name}
                checkSlugAvailabilityAction={checkShopSlugAvailability}
                slugTakenText="A shop with that page address already exists."
                slugRegionId="shop-slug-availability"
                initialSlug={shop.slug}
                excludeId={shop.id}
              />
            </EditorSection>

            <EditorSection title="Location" icon={SECTION_ICONS.linkedContext}>
              <label className="form-field">
                <span className="form-field-label">Location</span>
                <AdminSelect
                  name="locationId"
                  required
                  defaultValue={shop.locationId}
                  options={locationOptions}
                />
              </label>
            </EditorSection>

            <EditorSection title="Content" icon={SECTION_ICONS.content}>
              <RichDescriptionEditor
                initialValue={shop.descriptionRich}
                fallbackText={shop.description}
                error={
                  error === "invalid_rich_description"
                    ? "The formatted description could not be validated. Review it and try again."
                    : null
                }
              />
            </EditorSection>
          </div>

          <AdminFormGuard
            submitLabel="Save Changes"
            cancelHref={withShopSearchQuery(SHOP_LIST_PATH, query)}
            excludeFields={["id", "originalSlug", "verifiedGameVersionId"]}
            draftKey={`shop:edit:${shop.id}:shop-edit-form`}
            serverUpdatedAt={shop.updatedAt.toISOString()}
          />
        </form>
      </div>
    </ShopWorkspace>
  );
}
