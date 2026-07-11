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
  resultingQuantity: number;
  professionId: string | null;
  requiredLevel: number | null;
  ingredients: RecipeIngredientInput[];
};

export type RecipeValidationError =
  | "missing_name"
  | "invalid_slug"
  | "missing_resulting_item"
  | "invalid_resulting_quantity"
  | "invalid_required_level"
  | "no_ingredients"
  | "incomplete_ingredient"
  | "invalid_quantity"
  | "duplicate_ingredient";

export type RecipeParseResult =
  | { ok: true; value: RecipeInput }
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

export function parseRecipeInput(formData: FormData): RecipeParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const resultingItemId = String(formData.get("resultingItemId") ?? "").trim();
  const rawResultingQuantity = String(
    formData.get("resultingQuantity") ?? ""
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

  let resultingQuantity = 1;

  if (rawResultingQuantity) {
    const parsedResultingQuantity = Number(rawResultingQuantity);

    if (!isPositiveInteger(parsedResultingQuantity)) {
      return { ok: false, error: "invalid_resulting_quantity" };
    }

    resultingQuantity = parsedResultingQuantity;
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

  const ingredientsResult = parseIngredientRows(formData);

  if (!ingredientsResult.ok) {
    return { ok: false, error: ingredientsResult.error };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      resultingItemId,
      resultingQuantity,
      professionId: professionId || null,
      requiredLevel,
      ingredients: ingredientsResult.value,
    },
  };
}

export const RECIPE_INGREDIENT_ROW_COUNT = INGREDIENT_ROW_COUNT;
