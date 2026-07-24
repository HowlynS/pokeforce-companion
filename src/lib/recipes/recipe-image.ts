// Shared Recipe display-image precedence (Recipe Image Inheritance
// follow-up). A Recipe with no custom image of its own visually matches its
// selected resulting Item — display inheritance only, never persisted onto
// the Recipe record and never copied into Recipe.image. Pure and
// I/O-free by design: it takes whatever string identifies "an image" for
// each side (a stored object path on the server, or an already-resolved
// public URL on the client — the precedence is identical either way) and
// is safe to import from both server code and client components.

export type RecipeDisplayImageInput = {
  /** The Recipe's own persisted image (Recipe.image), or its resolved
      display form — the Recipe's authoritative, override image. */
  recipeImage: string | null;
  /** The selected resulting Item's image, or its resolved display form —
      read-only display fallback, never owned or mutated by the Recipe. */
  resultingItemImage: string | null;
};

/**
 * The Recipe display-image rule:
 * recipe image, otherwise the resulting item's image, otherwise null.
 */
export function resolveRecipeDisplayImage({
  recipeImage,
  resultingItemImage,
}: RecipeDisplayImageInput): string | null {
  return recipeImage ?? resultingItemImage ?? null;
}
