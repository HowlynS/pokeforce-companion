import { notFound } from "next/navigation";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { CurrencyWorkspace } from "@/components/admin/currency-workspace";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import {
  CURRENCY_LIST_PATH,
  currencyCanDelete,
  currencyEditorTabs,
  describeCurrencyShopListings,
  normalizeCurrencySearchQuery,
  withCurrencySearchQuery,
} from "@/lib/admin/currency-workspace";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import {
  deleteCurrencyAction,
  updateCurrencyAction,
} from "../../actions";
import { checkCurrencyNameAvailability } from "../../name-availability";
import { checkCurrencySlugAvailability } from "../../slug-availability";

export const dynamic = "force-dynamic";

const FORM_ID = "currency-edit-form";

const errorMessages: Record<string, string> = {
  missing_name: "Currency name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A currency with that page address already exists.",
  duplicate_name: "A currency with that name already exists.",
  linked_shop_listings:
    "This currency cannot be deleted while shop listings still reference it.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
  no_current_version:
    "No Game Version is marked as current. Select one under Game Versions before verifying this currency.",
  invalid_game_version:
    "The selected Game Version no longer exists. Refresh and try again.",
};

type EditCurrencyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditCurrencyPage({
  params,
  searchParams,
}: EditCurrencyPageProps) {
  await requireAdminUser();
  const { slug } = await params;
  const { q, error } = await searchParams;
  const query = normalizeCurrencySearchQuery(q);

  const [currency, gameVersions] = await Promise.all([
    prisma.currency.findUnique({
      where: { slug },
      include: {
        verifiedGameVersion: true,
        _count: { select: { shopListings: true } },
      },
    }),
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!currency) {
    notFound();
  }

  const imageUrl = await getImagePublicUrl(currency.image);
  const listingCount = currency._count.shopListings;
  const canDelete = currencyCanDelete(listingCount);
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  return (
    <CurrencyWorkspace
      key={currency.updatedAt.toISOString()}
      rawQuery={q}
      selectedSlug={currency.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Currency"
            title={currency.name}
            subtitle={currency.slug}
          />
          <EditorTabs
            label="Currency editor sections"
            tabs={currencyEditorTabs(currency.slug, query)}
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
            imageAlt={`Current image for ${currency.name}`}
            formId={FORM_ID}
          />
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={currency.verifiedAt}
            verifiedGameVersion={currency.verifiedGameVersion}
            formId={FORM_ID}
          />
          <TimestampsPanel
            createdAt={currency.createdAt}
            updatedAt={currency.updatedAt}
          />
          <DangerZonePanel
            resourceLabel="currency"
            deleteLabel="Delete Currency"
            dialogTitle="Delete Currency"
            dialogDescription={
              <>
                You are about to permanently delete{" "}
                <strong>{currency.name}</strong> ({currency.slug}). This
                action cannot be undone.
              </>
            }
            canDelete={canDelete}
            formAction={deleteCurrencyAction}
            hiddenFields={{ id: currency.id }}
          >
            <p className="text-muted">Shop listings: {listingCount}</p>
            {!canDelete ? (
              <p className="text-danger">
                Remove {describeCurrencyShopListings(listingCount)} before
                deleting this currency.
              </p>
            ) : null}
          </DangerZonePanel>
        </>
      }
    >
      <div className="admin-editor-surface">
        <form
          id={FORM_ID}
          action={updateCurrencyAction}
          className="form-grid form-grid-responsive"
        >
          <input type="hidden" name="id" value={currency.id} />
          <input type="hidden" name="originalSlug" value={currency.slug} />

          <div className="admin-editor-sections">
            <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
              <RecordIdentityFields
                checkNameAvailabilityAction={checkCurrencyNameAvailability}
                nameTakenText="A currency with that name already exists."
                nameRegionId="currency-name-availability"
                originalName={currency.name}
                checkSlugAvailabilityAction={checkCurrencySlugAvailability}
                slugTakenText="A currency with that page address already exists."
                slugRegionId="currency-slug-availability"
                initialSlug={currency.slug}
                excludeId={currency.id}
              />
            </EditorSection>

            <EditorSection title="Presentation" icon={SECTION_ICONS.details}>
              <label className="form-field">
                <span className="form-field-label">Symbol (optional)</span>
                <input
                  name="symbol"
                  defaultValue={currency.symbol ?? ""}
                  className="form-input"
                  placeholder="For example: ₽"
                />
              </label>
            </EditorSection>

            <EditorSection title="Content" icon={SECTION_ICONS.content}>
              <label className="form-field">
                <span className="form-field-label">Description (optional)</span>
                <AutosizeTextarea
                  name="description"
                  defaultValue={currency.description ?? ""}
                  className="form-input"
                />
              </label>
            </EditorSection>
          </div>

          <AdminFormGuard
            submitLabel="Save Changes"
            cancelHref={withCurrencySearchQuery(CURRENCY_LIST_PATH, query)}
            excludeFields={["id", "originalSlug", "verifiedGameVersionId"]}
            draftKey={`currency:edit:${currency.id}:currency-edit-form`}
            serverUpdatedAt={currency.updatedAt.toISOString()}
          />
        </form>
      </div>
    </CurrencyWorkspace>
  );
}
