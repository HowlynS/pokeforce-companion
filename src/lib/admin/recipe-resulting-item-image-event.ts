// One shared, explicit "the Recipe form's selected Resulting Item changed"
// signal (Recipe Image Inheritance follow-up), mirroring the existing
// FORM_CHANGE_EVENT / slug-restore-event.ts pattern in this codebase: a
// document-level CustomEvent rather than React context, so the Resulting
// Item select (inside the form's main content) and the Recipe image panel
// (rendered separately, in the workspace's aside column) can share this one
// piece of state without either needing to know where the other lives in
// the tree.
//
// This event carries ONLY a display image URL — never an item id, name, or
// any other field — so a listener can never derive more than "what image
// should the inherited preview show right now". It never touches form
// fields, is never listened for by AdminFormGuard, and therefore never
// contributes to dirty-state or drafts on its own.

export const RECIPE_RESULTING_ITEM_IMAGE_CHANGE_EVENT =
  "pf:recipe-resulting-item-image-change";

export type RecipeResultingItemImageChangeDetail = {
  imageUrl: string | null;
};

/** Dispatches the shared signal from `document`. A no-op outside a DOM
    environment (e.g. server rendering, or a non-DOM test). */
export function dispatchRecipeResultingItemImageChange(
  imageUrl: string | null
): void {
  if (typeof document === "undefined") {
    return;
  }
  try {
    document.dispatchEvent(
      new CustomEvent<RecipeResultingItemImageChangeDetail>(
        RECIPE_RESULTING_ITEM_IMAGE_CHANGE_EVENT,
        { detail: { imageUrl } }
      )
    );
  } catch {
    // CustomEvent unavailable — nothing to signal.
  }
}
