"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSelectOption } from "@/components/admin/admin-select";
import { SearchableAdminSelect } from "@/components/admin/searchable-admin-select";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import { RECIPE_INGREDIENT_MAX_ROWS } from "@/lib/validation/recipe";
import { readDraft } from "@/lib/admin/form-draft";

type IngredientRow = {
  key: number;
  itemId: string;
  quantity: string;
};

type RecipeIngredientEditorProps = {
  options: readonly AdminSelectOption[];
  initialIngredients?: readonly { itemId: string; quantity: number }[];
  draftKey?: string;
  serverError?: string;
};

const DUPLICATE_ERROR = "This item is already used as an ingredient.";

export function RecipeIngredientEditor({
  options,
  initialIngredients = [],
  draftKey,
  serverError,
}: RecipeIngredientEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nextKey = useRef(Math.max(1, initialIngredients.length) + 1);
  const [rows, setRows] = useState<IngredientRow[]>(
    initialIngredients.length > 0
      ? initialIngredients.map((ingredient, index) => ({
          key: index + 1,
          itemId: ingredient.itemId,
          quantity: String(ingredient.quantity),
        }))
      : [{ key: 1, itemId: "", quantity: "" }]
  );

  useEffect(() => {
    if (!draftKey) return;
    const values = readDraft(draftKey)?.values;
    const rowIds = Array.from(
      new Set(
        values?.ingredientRowIds?.[0]
          ?.split(",")
          .filter((value) => /^\d+$/.test(value)) ?? []
      )
    );
    if (!rowIds?.length) return;
    const restored = rowIds.slice(0, RECIPE_INGREDIENT_MAX_ROWS).map((id) => ({
      key: Number(id),
      itemId: values?.[`ingredientItemId${id}`]?.[0] ?? "",
      quantity: values?.[`ingredientQuantity${id}`]?.[0] ?? "",
    }));
    const restoreTimer = window.setTimeout(() => {
      nextKey.current = Math.max(...restored.map((row) => row.key)) + 1;
      setRows(restored);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [draftKey]);

  const duplicateKeys = useMemo(() => {
    const firstIndexByItem = new Map<string, number>();
    const duplicates = new Set<number>();
    rows.forEach((row, index) => {
      if (!row.itemId) return;
      if (firstIndexByItem.has(row.itemId)) duplicates.add(row.key);
      else firstIndexByItem.set(row.itemId, index);
    });
    return duplicates;
  }, [rows]);

  const firstPartialRow = rows.find(
    (row) => Boolean(row.itemId) !== Boolean(row.quantity)
  );
  const firstInvalidQuantityRow = rows.find((row) => {
    if (!row.quantity) return false;
    const quantity = Number(row.quantity);
    return !Number.isInteger(quantity) || !Number.isFinite(quantity) || quantity < 1;
  });
  const validItemIds = new Set(options.map((option) => option.value));
  const firstServerInvalidKey =
    serverError === "no_ingredients"
      ? rows[0]?.key
      : serverError === "incomplete_ingredient"
        ? firstPartialRow?.key
        : serverError === "invalid_quantity"
          ? firstInvalidQuantityRow?.key
          : serverError === "invalid_ingredient_item"
            ? rows.find(
                (row) =>
                  Boolean(row.itemId) && !validItemIds.has(row.itemId)
              )?.key
            : undefined;
  const firstServerInvalidRow = rows.find(
    (row) => row.key === firstServerInvalidKey
  );
  const focusSelectorForServerError =
    serverError === "no_ingredients" ||
    serverError === "invalid_ingredient_item" ||
    (serverError === "incomplete_ingredient" &&
      !firstServerInvalidRow?.itemId);

  function announceChange(target?: HTMLElement | null) {
    requestAnimationFrame(() => {
      const form = rootRef.current?.closest("form");
      dispatchFormChange(target ?? form);
    });
  }

  function addRow() {
    if (rows.length >= RECIPE_INGREDIENT_MAX_ROWS) return;
    const key = nextKey.current++;
    setRows((current) => [...current, { key, itemId: "", quantity: "" }]);
    announceChange();
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
    announceChange();
  }

  function updateRow(key: number, patch: Partial<IngredientRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const preventDuplicateSubmit = (event: SubmitEvent) => {
      if (duplicateKeys.size === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const firstDuplicateKey = rows.find((row) =>
        duplicateKeys.has(row.key)
      )?.key;
      document
        .getElementById(`recipe-ingredient-item-${firstDuplicateKey}`)
        ?.focus();
    };
    form.addEventListener("submit", preventDuplicateSubmit, true);
    return () =>
      form.removeEventListener("submit", preventDuplicateSubmit, true);
  }, [duplicateKeys, rows]);

  useEffect(() => {
    if (!firstServerInvalidKey) return;
    const focusTimer = window.setTimeout(() => {
      const invalidField = document.getElementById(
        focusSelectorForServerError
          ? `recipe-ingredient-item-${firstServerInvalidKey}`
          : `recipe-ingredient-quantity-${firstServerInvalidKey}`
      );
      invalidField?.focus();
      invalidField?.scrollIntoView({ block: "nearest" });
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [firstServerInvalidKey, focusSelectorForServerError]);

  return (
    <div ref={rootRef}>
      <input
        type="hidden"
        name="ingredientRowIds"
        value={rows.map((row) => row.key).join(",")}
      />
      <div className="recipe-ingredient-editor">
        {rows.map((row) => {
          const duplicate = duplicateKeys.has(row.key);
          const selectorServerInvalid =
            row.key === firstServerInvalidKey &&
            (serverError === "no_ingredients" ||
              (serverError === "incomplete_ingredient" && !row.itemId) ||
              serverError === "invalid_ingredient_item");
          const quantityServerInvalid =
            row.key === firstServerInvalidKey &&
            (serverError === "invalid_quantity" ||
              (serverError === "incomplete_ingredient" && Boolean(row.itemId)));
          const selectorError = duplicate
            ? DUPLICATE_ERROR
            : selectorServerInvalid
              ? serverError === "no_ingredients"
                ? "Add at least one ingredient."
                : serverError === "invalid_ingredient_item"
                  ? "Select an existing ingredient item."
                  : "Select an item for this ingredient."
              : null;
          const quantityError = quantityServerInvalid
            ? serverError === "invalid_quantity"
              ? "Quantity must be a whole number of at least 1."
              : "Enter a quantity for this ingredient."
            : null;
          const errorId = `recipe-ingredient-${row.key}-error`;
          return (
            <div key={row.key} className="ingredient-row ingredient-row-dynamic">
              <div className="form-field">
                <SearchableAdminSelect
                  id={`recipe-ingredient-item-${row.key}`}
                  name={`ingredientItemId${row.key}`}
                  value={row.itemId}
                  onValueChange={(itemId) => updateRow(row.key, { itemId })}
                  searchPlaceholder="Search items…"
                  noResultsLabel="No items match your search."
                  ariaInvalid={duplicate || selectorServerInvalid}
                  ariaDescribedBy={selectorError ? errorId : undefined}
                  autoFocus={selectorServerInvalid}
                  options={[
                    { value: "", label: "No ingredient", imageUrl: null },
                    ...options,
                  ]}
                />
                {selectorError ? (
                  <p id={errorId} className="form-field-feedback text-danger">
                    {selectorError}
                  </p>
                ) : null}
              </div>
              <div className="form-field">
                <input
                  id={`recipe-ingredient-quantity-${row.key}`}
                  type="number"
                  name={`ingredientQuantity${row.key}`}
                  min={1}
                  step={1}
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={(event) =>
                    updateRow(row.key, { quantity: event.target.value })
                  }
                  className="form-input"
                  aria-invalid={quantityServerInvalid || undefined}
                  aria-describedby={quantityError ? errorId : undefined}
                  autoFocus={quantityServerInvalid}
                />
                {quantityError ? (
                  <p id={errorId} className="form-field-feedback text-danger">
                    {quantityError}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="button button-secondary ingredient-row-remove"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                aria-label={`Remove ingredient row ${row.key}`}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
      {rows.length < RECIPE_INGREDIENT_MAX_ROWS ? (
        <button
          type="button"
          className="button button-secondary"
          onClick={addRow}
        >
          + Ingredient
        </button>
      ) : (
        <p className="form-field-help">Maximum of 50 ingredients reached.</p>
      )}
    </div>
  );
}
