import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import {
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeDeleteHref,
  recipeEditorTabs,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RecordNameField } from "@/components/admin/record-name-field";
import { updateRecipeGeneralAction } from "../../actions";
import { checkRecipeNameAvailability } from "../../name-availability";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const RECIPE_EDIT_FORM_ID = "recipe-edit-form";

// Errors updateRecipeGeneralAction can actually produce (Slice 9C.3):
// ingredient-specific errors (no_ingredients, incomplete_ingredient,
// invalid_quantity, duplicate_ingredient, invalid_ingredient_item) belong
// to the Ingredients tab's own action and route now.
const errorMessages: Record<string, string> = {
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
  missing_name: "Recipe name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  missing_resulting_item: "Select the item this recipe produces.",
  invalid_resulting_quantity:
    "Resulting quantity must be a whole number of at least 1.",
  invalid_required_level:
    "Required level must be a whole number of zero or more.",
  invalid_resulting_item: "Select an existing item as the recipe's result.",
  invalid_profession: "Select an existing profession, or choose No profession.",
  duplicate: "A recipe with that name or slug already exists.",
  duplicate_name: "A recipe with that name already exists.",
  missing_recipe: "That recipe no longer exists.",
  relation_changed:
    "The selected item, or the profession, no longer exists. Please review your selections and try again.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

type EditRecipePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditRecipePage({
  params,
  searchParams,
}: EditRecipePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeRecipeSearchQuery(q);

  const [recipe, items, professions] = await Promise.all([
    prisma.recipe.findUnique({
      where: { slug },
      // Admin-only visibility of the verification stamp: the related Game
      // Version's name is shown in the aside's VerificationPanel below.
      // No ingredients include — General never touches or displays them
      // (Slice 9C.3 moved that to its own Ingredients tab/route).
      include: { verifiedGameVersion: true },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!recipe) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(recipe.image);

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  const tabs = recipeEditorTabs(recipe.slug, query, "general");

  // The General edit route inside the Recipe workspace (Slice 9C.3): the
  // record list marks this recipe selected and keeps the active search
  // applied for quick switching. This page is now ALWAYS fully editable,
  // regardless of how many ingredients the recipe carries — the former
  // all-or-nothing too-many-ingredients guard moved to the Ingredients
  // tab/route, which is the only place ingredient rows exist now. Every
  // remaining field, redirect, image behavior, and verification rule is
  // unchanged — only ingredients and their guard moved out. Delete lives
  // in the header's action slot (EditorHeader `actions`), unconditional
  // exactly as before.
  return (
    <RecipeWorkspace
      rawQuery={q}
      selectedSlug={recipe.slug}
      header={
        <>
          <EditorHeader
            eyebrow="Recipe"
            title={recipe.name}
            subtitle={recipe.slug}
          />

          <EditorTabs label="Recipe editor sections" tabs={tabs} />

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
            imageAlt={`Current image for ${recipe.name}`}
            formId={RECIPE_EDIT_FORM_ID}
          />

          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={recipe.verifiedAt}
            verifiedGameVersion={recipe.verifiedGameVersion}
            formId={RECIPE_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={recipe.createdAt}
            updatedAt={recipe.updatedAt}
          />

          <DangerZonePanel
            resourceLabel="recipe"
            deleteHref={recipeDeleteHref(recipe.slug, query)}
            deleteLabel="Delete Recipe"
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={RECIPE_EDIT_FORM_ID}
        action={updateRecipeGeneralAction}
        className="form-grid form-grid-wide form-grid-responsive"
      >
        <input type="hidden" name="id" value={recipe.id} />
        <input type="hidden" name="originalSlug" value={recipe.slug} />

        <p className="form-section-heading">Identity</p>

        {/* Client-enhanced Name field with live duplicate feedback. The
            saved name counts as "current" (never queried), and the
            record's own id is excluded server-side so it cannot conflict
            with itself; updateRecipeGeneralAction stays the authoritative
            check. */}
        <RecordNameField
          checkAvailabilityAction={checkRecipeNameAvailability}
          takenText="A recipe with that name already exists."
          regionId="recipe-name-availability"
          originalName={recipe.name}
          excludeId={recipe.id}
        />

        <label className="form-field">
          <span className="form-field-label">Slug</span>
          <input
            type="text"
            name="slug"
            defaultValue={recipe.slug}
            className="form-input"
          />
        </label>

        <p className="form-section-heading">Output</p>

        <label className="form-field">
          <span className="form-field-label">Resulting item</span>
          <select
            name="resultingItemId"
            required
            defaultValue={recipe.resultingItemId}
            className="form-input"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field-label">Resulting quantity</span>
          <input
            type="number"
            name="resultingQuantity"
            min={1}
            step={1}
            defaultValue={recipe.resultingQuantity}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">Profession</span>
          <select
            name="professionId"
            defaultValue={recipe.professionId ?? ""}
            className="form-input"
          >
            <option value="">No profession</option>
            {professions.map((profession) => (
              <option key={profession.id} value={profession.id}>
                {profession.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field-label">Required level (optional)</span>
          <input
            type="number"
            name="requiredLevel"
            min={0}
            step={1}
            defaultValue={recipe.requiredLevel ?? ""}
            className="form-input"
          />
        </label>

        <EditorActions
          submitLabel="Save Changes"
          cancelHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
        />
      </form>
      </div>
    </RecipeWorkspace>
  );
}
