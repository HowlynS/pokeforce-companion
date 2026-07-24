"use client";

// The Recipe form's Resulting Item picker (Recipe Image Inheritance
// follow-up): the exact same AdminSelect every other relation picker uses,
// plus one additional side effect — announcing the newly selected item's
// image over the shared document event (see
// recipe-resulting-item-image-event.ts) so the Recipe image panel, which
// renders separately in the workspace's aside column, can update its
// inherited preview immediately. Submission, validation, required-ness,
// and every other AdminSelect behavior are completely unchanged; this
// component adds no field of its own and writes nothing to the DOM beyond
// what AdminSelect already renders for `name="resultingItemId"`.

import { AdminSelect, type AdminSelectOption } from "@/components/admin/admin-select";
import { dispatchRecipeResultingItemImageChange } from "@/lib/admin/recipe-resulting-item-image-event";

type RecipeResultingItemSelectProps = {
  options: readonly AdminSelectOption[];
  defaultValue: string;
  /** Resolved image URL per item id (or null), built once from the same
      options the caller already resolved for the dropdown itself — no
      second lookup or query. */
  itemImageById: Readonly<Record<string, string | null>>;
  placeholder?: string;
  required?: boolean;
};

export function RecipeResultingItemSelect({
  options,
  defaultValue,
  itemImageById,
  placeholder,
  required = true,
}: RecipeResultingItemSelectProps) {
  return (
    <AdminSelect
      name="resultingItemId"
      required={required}
      defaultValue={defaultValue}
      placeholder={placeholder}
      options={options}
      onValueChange={(value) => {
        dispatchRecipeResultingItemImageChange(itemImageById[value] ?? null);
      }}
    />
  );
}
