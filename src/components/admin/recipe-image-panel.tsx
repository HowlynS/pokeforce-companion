"use client";

// The Recipe workspace's own image panel (Recipe Image Inheritance
// follow-up): a thin, Recipe-specific wrapper over the shared ImagePanel —
// never a fork of it — that (1) tracks the currently selected Resulting
// Item's image via the shared document event dispatched by
// RecipeResultingItemSelect, and (2) supplies the Recipe-specific
// inherited/override explanatory copy. Every other resource (Item,
// Profession, Category, Location) keeps calling ImagePanel directly with no
// behavior change: the inheritance props ImagePanel gained are inert unless
// a caller opts in, and only this wrapper opts in, and only with Recipe
// wording.
//
// Upload, replacement, removal, validation, storage, and cleanup behavior
// all stay exactly where they already were (ImagePanel itself, and the
// Recipe server actions) — this wrapper never touches the "image"/
// "removeImage" fields and introduces no new form input.

import { useEffect, useState } from "react";
import { ImagePanel } from "@/components/admin/image-panel";
import {
  RECIPE_RESULTING_ITEM_IMAGE_CHANGE_EVENT,
  type RecipeResultingItemImageChangeDetail,
} from "@/lib/admin/recipe-resulting-item-image-event";

const INHERITED_NOTE =
  "Using the resulting item's image. Upload a Recipe image only to override it.";
const OVERRIDE_NOTE =
  "This Recipe uses a custom image override. Removing it will restore the resulting item's image.";

type RecipeImagePanelProps = {
  /** The Recipe's own persisted image URL, or null when it has none. */
  imageUrl: string | null;
  imageAlt?: string;
  formId: string;
  /** The currently selected Resulting Item's image URL at load — before
      any change event has fired — or null when no item is selected yet
      (the create page's initial state) or the selected item has no image
      of its own. */
  initialInheritedImageUrl: string | null;
  inheritedImageAlt?: string;
};

export function RecipeImagePanel({
  imageUrl,
  imageAlt,
  formId,
  initialInheritedImageUrl,
  inheritedImageAlt,
}: RecipeImagePanelProps) {
  const [inheritedImageUrl, setInheritedImageUrl] = useState(
    initialInheritedImageUrl
  );

  useEffect(() => {
    function onChange(event: Event) {
      const detail = (
        event as CustomEvent<RecipeResultingItemImageChangeDetail>
      ).detail;
      setInheritedImageUrl(detail.imageUrl);
    }

    document.addEventListener(
      RECIPE_RESULTING_ITEM_IMAGE_CHANGE_EVENT,
      onChange
    );
    return () =>
      document.removeEventListener(
        RECIPE_RESULTING_ITEM_IMAGE_CHANGE_EVENT,
        onChange
      );
  }, []);

  return (
    <ImagePanel
      imageUrl={imageUrl}
      imageAlt={imageAlt}
      formId={formId}
      inheritedImageUrl={inheritedImageUrl}
      inheritedImageAlt={inheritedImageAlt}
      inheritedNote={INHERITED_NOTE}
      overrideNote={OVERRIDE_NOTE}
    />
  );
}
