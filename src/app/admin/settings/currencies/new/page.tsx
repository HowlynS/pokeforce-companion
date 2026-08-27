import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { RichDescriptionEditor } from "@/components/admin/rich-description-editor";
import { CurrencyWorkspace } from "@/components/admin/currency-workspace";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { VerificationPanel } from "@/components/admin/verification-panel";
import {
  CURRENCY_CREATE_PATH,
  CURRENCY_LIST_PATH,
  normalizeCurrencySearchQuery,
  withCurrencySearchQuery,
} from "@/lib/admin/currency-workspace";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { createCurrencyAction } from "../actions";
import { checkCurrencyNameAvailability } from "../name-availability";
import { checkCurrencySlugAvailability } from "../slug-availability";

export const dynamic = "force-dynamic";

const FORM_ID = "currency-create-form";

const errorMessages: Record<string, string> = {
  missing_name: "Currency name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  invalid_rich_description:
    "The formatted description could not be validated. Review it and try again.",
  duplicate: "A currency with that page address already exists.",
  duplicate_name: "A currency with that name already exists.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  no_current_version:
    "No Game Version is marked as current. Select one under Game Versions before verifying this currency.",
  invalid_game_version:
    "The selected Game Version no longer exists. Refresh and try again.",
};

type NewCurrencyPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewCurrencyPage({
  searchParams,
}: NewCurrencyPageProps) {
  await requireAdminUser();
  const { q, error } = await searchParams;
  const query = normalizeCurrencySearchQuery(q);
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withCurrencySearchQuery(CURRENCY_CREATE_PATH, query),
      active: true,
    },
  ];
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  return (
    <CurrencyWorkspace
      rawQuery={q}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Currency"
            title="Create Currency"
            subtitle="Add a game currency for structured shop prices."
          />
          <EditorTabs label="Currency editor sections" tabs={tabs} />
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
            verificationPermission="content.currencies.verify"
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
          action={createCurrencyAction}
          className="form-grid form-grid-responsive"
        >
          <div className="admin-editor-sections">
            <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
              <RecordIdentityFields
                checkNameAvailabilityAction={checkCurrencyNameAvailability}
                nameTakenText="A currency with that name already exists."
                nameRegionId="currency-name-availability"
                checkSlugAvailabilityAction={checkCurrencySlugAvailability}
                slugTakenText="A currency with that page address already exists."
                slugRegionId="currency-slug-availability"
              />
            </EditorSection>

            <EditorSection title="Presentation" icon={SECTION_ICONS.details}>
              <label className="form-field">
                <span className="form-field-label">Symbol (optional)</span>
                <input
                  name="symbol"
                  className="form-input"
                  placeholder="For example: ₽"
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
            submitLabel="Create Currency"
            cancelHref={withCurrencySearchQuery(CURRENCY_LIST_PATH, query)}
            excludeFields={["verifiedGameVersionId"]}
            draftKey="currency:new:currency-create-form"
          />
        </form>
      </div>
    </CurrencyWorkspace>
  );
}
