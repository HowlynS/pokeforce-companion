import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { RECIPE_INGREDIENT_ROW_COUNT } from "@/lib/validation/recipe";
import { RecordNameField } from "@/components/admin/record-name-field";
import { createRecipeAction } from "./actions";
import { checkRecipeNameAvailability } from "./name-availability";

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

const successMessages: Record<string, string> = {
  created: "Recipe created.",
  updated: "Recipe updated.",
  updated_image_cleanup:
    "Recipe updated, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  deleted: "Recipe deleted.",
  deleted_image_cleanup:
    "Recipe deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
};

type AdminRecipesPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminRecipesPage({
  searchParams,
}: AdminRecipesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  const [recipes, items, professions] = await Promise.all([
    prisma.recipe.findMany({
      include: {
        resultingItem: true,
        profession: true,
        ingredients: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  const inputStyle = {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: designTokens.radius.sm,
    background: designTokens.colors.surface,
    color: designTokens.colors.text,
    padding: "10px 12px",
    fontSize: "16px",
    fontFamily: "inherit",
  };

  const ingredientRows = Array.from(
    { length: RECIPE_INGREDIENT_ROW_COUNT },
    (_, index) => index + 1
  );

  return (
    <AppShell>
      <PageHeader
        title="Recipe Management"
        description="View existing recipes and create new ones."
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Admin
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

      {successMessage ? (
        <p
          role="status"
          style={{
            border: `1px solid ${designTokens.colors.success}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.success,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {successMessage}
        </p>
      ) : null}

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <h2 style={{ fontSize: "24px", lineHeight: 1.2, margin: "0 0 16px" }}>
          Existing Recipes
        </h2>

        {recipes.length > 0 ? (
          <div
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.md,
              background: designTokens.colors.surface,
              overflow: "hidden",
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Slug", "Result", "Profession", "Ingredients", "Actions"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          borderBottom: `1px solid ${designTokens.colors.border}`,
                          color: designTokens.colors.textMuted,
                          fontSize: "14px",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      {recipe.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {recipe.slug}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {recipe.resultingQuantity}x {recipe.resultingItem.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {recipe.profession?.name ?? "No profession"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {recipe.ingredients.length}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      <a
                        href={`/admin/recipes/${recipe.slug}/edit`}
                        style={{ color: designTokens.colors.accent, marginRight: "16px" }}
                      >
                        Edit
                      </a>
                      <a
                        href={`/admin/recipes/${recipe.slug}/delete`}
                        style={{ color: designTokens.colors.danger }}
                      >
                        Delete
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No recipes yet"
            description="Create the first recipe using the form below."
          />
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "24px", lineHeight: 1.2, margin: "0 0 16px" }}>
          Create Recipe
        </h2>

        {items.length === 0 ? (
          <EmptyState
            title="No items available"
            description="Create at least one item before creating a recipe."
          />
        ) : (
          <form
            action={createRecipeAction}
            style={{
              display: "grid",
              gap: "16px",
              maxWidth: "560px",
            }}
          >
            {/* Client-enhanced Name field with live duplicate feedback; the
                submission-time duplicate check in createRecipeAction remains
                the authoritative protection. */}
            <RecordNameField
              checkAvailabilityAction={checkRecipeNameAvailability}
              takenText="A recipe with that name already exists."
              regionId="recipe-name-availability"
              inputStyle={inputStyle}
            />

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ color: designTokens.colors.textMuted }}>
                Slug (optional — generated from name if left blank)
              </span>
              <input type="text" name="slug" style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ color: designTokens.colors.textMuted }}>
                Resulting item
              </span>
              <select name="resultingItemId" required defaultValue="" style={inputStyle}>
                <option value="" disabled>
                  Select an item
                </option>
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
                defaultValue={1}
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ color: designTokens.colors.textMuted }}>
                Profession
              </span>
              <select name="professionId" defaultValue="" style={inputStyle}>
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

              {ingredientRows.map((row) => (
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
                    defaultValue=""
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
                    style={inputStyle}
                  />
                </div>
              ))}
            </fieldset>

            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ color: designTokens.colors.textMuted }}>
                Image (optional — PNG, JPEG, or WebP, up to 5 MB)
              </span>
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
                style={inputStyle}
              />
            </label>

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
                justifySelf: "start",
              }}
            >
              Create Recipe
            </button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
