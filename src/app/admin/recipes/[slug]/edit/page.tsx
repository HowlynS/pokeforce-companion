import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { RECIPE_INGREDIENT_ROW_COUNT } from "@/lib/validation/recipe";
import { updateRecipeAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Recipe name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  missing_resulting_item: "Select the item this recipe produces.",
  invalid_resulting_quantity:
    "Resulting quantity must be a whole number of at least 1.",
  invalid_required_level:
    "Required level must be a whole number of zero or more.",
  no_ingredients: "Add at least one ingredient.",
  incomplete_ingredient:
    "Each ingredient row needs both an item and a quantity.",
  invalid_quantity:
    "Ingredient quantities must be whole numbers of at least 1.",
  duplicate_ingredient: "Each ingredient can only be added once.",
  invalid_resulting_item: "Select an existing item as the recipe's result.",
  invalid_profession: "Select an existing profession, or choose No profession.",
  invalid_ingredient_item:
    "One or more selected ingredient items no longer exist.",
  duplicate: "A recipe with that name or slug already exists.",
  duplicate_name: "A recipe with that name already exists.",
  missing_recipe: "That recipe no longer exists.",
  relation_changed:
    "One of the selected items, or the profession, no longer exists. Please review your selections and try again.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

type EditRecipePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditRecipePage({
  params,
  searchParams,
}: EditRecipePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const [recipe, items, professions] = await Promise.all([
    prisma.recipe.findUnique({
      where: { slug },
      include: {
        ingredients: {
          include: { item: true },
          orderBy: { item: { name: "asc" } },
        },
      },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!recipe) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(recipe.image);

  const inputStyle = {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: designTokens.radius.sm,
    background: designTokens.colors.surface,
    color: designTokens.colors.text,
    padding: "10px 12px",
    fontSize: "16px",
    fontFamily: "inherit",
  };

  const tooManyIngredients =
    recipe.ingredients.length > RECIPE_INGREDIENT_ROW_COUNT;

  const ingredientRows = Array.from(
    { length: RECIPE_INGREDIENT_ROW_COUNT },
    (_, index) => index + 1
  );

  return (
    <AppShell>
      <PageHeader
        title="Edit Recipe"
        description={`Update details for "${recipe.name}".`}
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin/recipes" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Recipe Management
        </a>
      </p>

      {errorMessage ? (
        <p
          role="alert"
          style={{
            border: `1px solid ${designTokens.colors.danger}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.danger,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      {tooManyIngredients ? (
        <p
          role="alert"
          style={{
            border: `1px solid ${designTokens.colors.danger}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.danger,
            padding: "12px 16px",
          }}
        >
          This recipe has {recipe.ingredients.length} ingredients, but the
          edit form currently supports only {RECIPE_INGREDIENT_ROW_COUNT}.
          Editing is unavailable until the form supports more ingredient
          rows, so none of this recipe&apos;s data is at risk of being
          dropped.
        </p>
      ) : (
        <form
          action={updateRecipeAction}
          style={{
            display: "grid",
            gap: "16px",
            maxWidth: "560px",
          }}
        >
          <input type="hidden" name="id" value={recipe.id} />
          <input type="hidden" name="originalSlug" value={recipe.slug} />

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>Name</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={recipe.name}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>Slug</span>
            <input
              type="text"
              name="slug"
              defaultValue={recipe.slug}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Resulting item
            </span>
            <select
              name="resultingItemId"
              required
              defaultValue={recipe.resultingItemId}
              style={inputStyle}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Resulting quantity
            </span>
            <input
              type="number"
              name="resultingQuantity"
              min={1}
              step={1}
              defaultValue={recipe.resultingQuantity}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Profession
            </span>
            <select
              name="professionId"
              defaultValue={recipe.professionId ?? ""}
              style={inputStyle}
            >
              <option value="">No profession</option>
              {professions.map((profession) => (
                <option key={profession.id} value={profession.id}>
                  {profession.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Required level (optional)
            </span>
            <input
              type="number"
              name="requiredLevel"
              min={0}
              step={1}
              defaultValue={recipe.requiredLevel ?? ""}
              style={inputStyle}
            />
          </label>

          <fieldset
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.sm,
              padding: "16px",
              display: "grid",
              gap: "12px",
            }}
          >
            <legend style={{ color: designTokens.colors.textMuted, padding: "0 4px" }}>
              Ingredients (fill at least one row)
            </legend>

            {ingredientRows.map((row) => {
              const existingIngredient = recipe.ingredients[row - 1];

              return (
                <div
                  key={row}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "8px",
                  }}
                >
                  <select
                    name={`ingredientItemId${row}`}
                    defaultValue={existingIngredient?.itemId ?? ""}
                    style={inputStyle}
                  >
                    <option value="">No ingredient</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    name={`ingredientQuantity${row}`}
                    min={1}
                    step={1}
                    placeholder="Qty"
                    defaultValue={existingIngredient?.quantity ?? ""}
                    style={inputStyle}
                  />
                </div>
              );
            })}
          </fieldset>

          <div style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Current image
            </span>
            {imageUrl ? (
              <div style={{ position: "relative", justifySelf: "start" }}>
                <style>{`
                  .remove-image-checkbox,
                  .remove-image-hidden-text {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    margin: -1px;
                    padding: 0;
                    overflow: hidden;
                    clip: rect(0 0 0 0);
                    white-space: nowrap;
                    border: 0;
                  }
                  .remove-image-frame {
                    position: relative;
                    display: inline-block;
                  }
                  .remove-image-toggle {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    border-radius: 9999px;
                    background: ${designTokens.colors.danger};
                    color: ${designTokens.colors.background};
                    font-size: 14px;
                    font-weight: 700;
                    line-height: 1;
                    cursor: pointer;
                    user-select: none;
                  }
                  .remove-image-checkbox:focus-visible ~ .remove-image-frame .remove-image-toggle {
                    outline: 2px solid ${designTokens.colors.accent};
                    outline-offset: 2px;
                  }
                  .remove-image-checkbox:checked ~ .remove-image-frame img {
                    opacity: 0.35;
                  }
                  .remove-image-note {
                    display: none;
                    margin: 6px 0 0;
                    color: ${designTokens.colors.danger};
                  }
                  .remove-image-checkbox:checked ~ .remove-image-note {
                    display: block;
                  }
                `}</style>
                <input
                  type="checkbox"
                  name="removeImage"
                  id="removeImage"
                  className="remove-image-checkbox"
                />
                <div className="remove-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview; remote next/image configuration is deferred to the public-display slice */}
                  <img
                    src={imageUrl}
                    alt={`Current image for ${recipe.name}`}
                    style={{
                      maxWidth: "128px",
                      height: "auto",
                      border: `1px solid ${designTokens.colors.border}`,
                      borderRadius: designTokens.radius.sm,
                      background: designTokens.colors.surface,
                      padding: "8px",
                      display: "block",
                    }}
                  />
                  <label
                    htmlFor="removeImage"
                    title="Remove current image"
                    className="remove-image-toggle"
                  >
                    <span aria-hidden="true">&times;</span>
                    <span className="remove-image-hidden-text">
                      Remove current image
                    </span>
                  </label>
                </div>
                <p className="remove-image-note">
                  Image will be removed when saved.
                </p>
              </div>
            ) : (
              <span style={{ color: designTokens.colors.textMuted }}>
                No image uploaded.
              </span>
            )}
          </div>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              {recipe.image
                ? "Replacement image (optional — PNG, JPEG, or WebP, up to 5 MB)"
                : "Image (optional — PNG, JPEG, or WebP, up to 5 MB)"}
            </span>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              style={inputStyle}
            />
          </label>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="submit"
              style={{
                border: "none",
                borderRadius: designTokens.radius.sm,
                background: designTokens.colors.accent,
                color: designTokens.colors.background,
                padding: "12px 16px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Save Changes
            </button>

            <a
              href="/admin/recipes"
              style={{
                border: `1px solid ${designTokens.colors.border}`,
                borderRadius: designTokens.radius.sm,
                background: designTokens.colors.surfaceSoft,
                color: designTokens.colors.text,
                padding: "12px 16px",
                fontSize: "16px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Cancel
            </a>
          </div>
        </form>
      )}
    </AppShell>
  );
}
