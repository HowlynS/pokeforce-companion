const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const INGREDIENT_ROW_COUNT = 5;

export type RecipeIngredientInput = {
  itemId: string;
  quantity: number;
};

export type RecipeInput = {
  name: string;
  slug: string;
  resultingItemId: string;
  resultQuantityMin: number;
  resultQuantityMax: number;
  professionId: string | null;
  requiredLevel: number | null;
  ingredients: RecipeIngredientInput[];
};

/** The Recipe General editor's own field set (Slice 9C.3) — everything
    `RecipeInput` carries except `ingredients`, which now belongs to the
    separate Ingredients tab. */
export type RecipeGeneralInput = Omit<RecipeInput, "ingredients">;

/** Ingredients tab's own field set (Slice 9C.3) — nothing but the rows. */
export type RecipeIngredientsInput = {
  ingredients: RecipeIngredientInput[];
};

export type RecipeValidationError =
  | "missing_name"
  | "invalid_slug"
  | "missing_resulting_item"
  | "invalid_result_quantity_min"
  | "invalid_result_quantity_max"
  | "invalid_result_quantity_range"
  | "invalid_required_level"
  | "no_ingredients"
  | "incomplete_ingredient"
  | "invalid_quantity"
  | "duplicate_ingredient";

export type RecipeParseResult =
  | { ok: true; value: RecipeInput }
  | { ok: false; error: RecipeValidationError };

export type RecipeGeneralParseResult =
  | { ok: true; value: RecipeGeneralInput }
  | { ok: false; error: RecipeValidationError };

export type RecipeIngredientsParseResult =
  | { ok: true; value: RecipeIngredientsInput }
  | { ok: false; error: RecipeValidationError };

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && Number.isFinite(value) && value >= 1;
}

type IngredientRowsResult =
  | { ok: true; value: RecipeIngredientInput[] }
  | { ok: false; error: RecipeValidationError };

function parseIngredientRows(formData: FormData): IngredientRowsResult {
  const ingredients: RecipeIngredientInput[] = [];

  for (let row = 1; row <= INGREDIENT_ROW_COUNT; row++) {
    const itemId = String(formData.get(`ingredientItemId${row}`) ?? "").trim();
    const rawQuantity = String(
      formData.get(`ingredientQuantity${row}`) ?? ""
    ).trim();

    if (!itemId && !rawQuantity) {
      // Unused row; fixed rows may be left blank.
      continue;
    }

    if (!itemId || !rawQuantity) {
      return { ok: false, error: "incomplete_ingredient" };
    }

    const quantity = Number(rawQuantity);

    if (!isPositiveInteger(quantity)) {
      return { ok: false, error: "invalid_quantity" };
    }

    ingredients.push({ itemId, quantity });
  }

  if (ingredients.length === 0) {
    return { ok: false, error: "no_ingredients" };
  }

  const uniqueItemIds = new Set(
    ingredients.map((ingredient) => ingredient.itemId)
  );

  if (uniqueItemIds.size !== ingredients.length) {
    return { ok: false, error: "duplicate_ingredient" };
  }

  return { ok: true, value: ingredients };
}

// Every field EXCEPT ingredients — shared by the full parser (create page,
// which still submits everything together) and the General-only parser
// (Slice 9C.3's edit page, which never touches ingredients). Extracted
// once so the two callers can never validate these fields differently.
function parseRecipeGeneralFields(formData: FormData): RecipeGeneralParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const resultingItemId = String(formData.get("resultingItemId") ?? "").trim();
  const rawResultQuantityMin = String(
    formData.get("resultQuantityMin") ?? ""
  ).trim();
  const rawResultQuantityMax = String(
    formData.get("resultQuantityMax") ?? ""
  ).trim();
  const professionId = String(formData.get("professionId") ?? "").trim();
  const rawRequiredLevel = String(formData.get("requiredLevel") ?? "").trim();

  if (!name) {
    return { ok: false, error: "missing_name" };
  }

  // Slug is optional in the form; fall back to deriving it from the name.
  const slug = normalizeSlug(rawSlug || name);

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }

  if (!resultingItemId) {
    return { ok: false, error: "missing_resulting_item" };
  }

  // Both quantity fields are required — unlike the old single quantity
  // field, a blank submission is never silently defaulted to 1 here (the
  // form itself pre-fills 1 on create, so a blank value only reaches this
  // parser if a contributor deliberately clears the field).
  if (!rawResultQuantityMin) {
    return { ok: false, error: "invalid_result_quantity_min" };
  }

  const resultQuantityMin = Number(rawResultQuantityMin);

  if (!isPositiveInteger(resultQuantityMin)) {
    return { ok: false, error: "invalid_result_quantity_min" };
  }

  if (!rawResultQuantityMax) {
    return { ok: false, error: "invalid_result_quantity_max" };
  }

  const resultQuantityMax = Number(rawResultQuantityMax);

  if (!isPositiveInteger(resultQuantityMax)) {
    return { ok: false, error: "invalid_result_quantity_max" };
  }

  if (resultQuantityMax < resultQuantityMin) {
    return { ok: false, error: "invalid_result_quantity_range" };
  }

  let requiredLevel: number | null = null;

  if (rawRequiredLevel) {
    const parsedRequiredLevel = Number(rawRequiredLevel);

    if (
      !Number.isInteger(parsedRequiredLevel) ||
      !Number.isFinite(parsedRequiredLevel) ||
      parsedRequiredLevel < 0
    ) {
      return { ok: false, error: "invalid_required_level" };
    }

    requiredLevel = parsedRequiredLevel;
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      resultingItemId,
      resultQuantityMin,
      resultQuantityMax,
      professionId: professionId || null,
      requiredLevel,
    },
  };
}

/** The Recipe General editor's own parser (Slice 9C.3): every field
    except ingredients, reusing the exact field-by-field validation
    `parseRecipeInput` has always used — never a second implementation. */
export function parseRecipeGeneralInput(
  formData: FormData
): RecipeGeneralParseResult {
  return parseRecipeGeneralFields(formData);
}

/** The Ingredients tab's own parser (Slice 9C.3): reuses the exact same
    row-parsing/deduplication/limit logic `parseRecipeInput` has always
    used, wrapped for a caller that only ever supplies ingredient rows. */
export function parseRecipeIngredientsInput(
  formData: FormData
): RecipeIngredientsParseResult {
  const ingredientsResult = parseIngredientRows(formData);

  if (!ingredientsResult.ok) {
    return { ok: false, error: ingredientsResult.error };
  }

  return { ok: true, value: { ingredients: ingredientsResult.value } };
}

export function parseRecipeInput(formData: FormData): RecipeParseResult {
  const generalResult = parseRecipeGeneralFields(formData);

  if (!generalResult.ok) {
    return generalResult;
  }

  const ingredientsResult = parseIngredientRows(formData);

  if (!ingredientsResult.ok) {
    return { ok: false, error: ingredientsResult.error };
  }

  return {
    ok: true,
    value: { ...generalResult.value, ingredients: ingredientsResult.value },
  };
}

export const RECIPE_INGREDIENT_ROW_COUNT = INGREDIENT_ROW_COUNT;
