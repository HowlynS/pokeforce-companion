import { describe, expect, it } from "vitest";
import {
  RECIPE_INGREDIENT_ROW_COUNT,
  normalizeSlug,
  parseRecipeGeneralInput,
  parseRecipeIngredientsInput,
  parseRecipeInput,
} from "@/lib/validation/recipe";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

// A minimal valid submission: name, a resulting item, a fixed 1/1 result
// quantity (matching the form's own default), and one ingredient row.
function validRecipeEntries(): Record<string, string> {
  return {
    name: "Iron Ingot",
    resultingItemId: "item-result",
    resultQuantityMin: "1",
    resultQuantityMax: "1",
    ingredientItemId1: "item-a",
    ingredientQuantity1: "2",
  };
}

describe("normalizeSlug (recipe)", () => {
  it("trims, lowercases, and hyphenates the value", () => {
    expect(normalizeSlug("  Iron Ingot  ")).toBe("iron-ingot");
  });
});

describe("parseRecipeInput", () => {
  it("rejects a missing name", () => {
    const entries = validRecipeEntries();
    entries.name = "  ";

    expect(parseRecipeInput(formDataFrom(entries))).toEqual({
      ok: false,
      error: "missing_name",
    });
  });

  it("derives the slug from the name and accepts a supplied slug", () => {
    const derived = parseRecipeInput(formDataFrom(validRecipeEntries()));
    const supplied = parseRecipeInput(
      formDataFrom({ ...validRecipeEntries(), slug: " Forge Recipe " })
    );

    expect(derived.ok && derived.value.slug).toBe("iron-ingot");
    expect(supplied.ok && supplied.value.slug).toBe("forge-recipe");
  });

  it("rejects a name that produces an empty slug", () => {
    const entries = validRecipeEntries();
    entries.name = "!!!";

    expect(parseRecipeInput(formDataFrom(entries))).toEqual({
      ok: false,
      error: "invalid_slug",
    });
  });

  it("rejects a missing resulting item", () => {
    const entries = validRecipeEntries();
    entries.resultingItemId = "  ";

    expect(parseRecipeInput(formDataFrom(entries))).toEqual({
      ok: false,
      error: "missing_resulting_item",
    });
  });

  it("treats a blank profession as null and keeps a supplied one", () => {
    const blank = parseRecipeInput(formDataFrom(validRecipeEntries()));
    const supplied = parseRecipeInput(
      formDataFrom({ ...validRecipeEntries(), professionId: " prof-1 " })
    );

    expect(blank.ok && blank.value.professionId).toBeNull();
    expect(supplied.ok && supplied.value.professionId).toBe("prof-1");
  });

  describe("result quantity range", () => {
    // Blank is explicitly REJECTED rather than silently defaulted (unlike
    // the old single quantity field) — the form itself pre-fills 1 on
    // create, so a blank value only reaches the parser if a contributor
    // deliberately clears the field.
    it("rejects a blank minimum", () => {
      const result = parseRecipeInput(
        formDataFrom({ ...validRecipeEntries(), resultQuantityMin: "" })
      );

      expect(result).toEqual({
        ok: false,
        error: "invalid_result_quantity_min",
      });
    });

    it("rejects a blank maximum", () => {
      const result = parseRecipeInput(
        formDataFrom({ ...validRecipeEntries(), resultQuantityMax: "" })
      );

      expect(result).toEqual({
        ok: false,
        error: "invalid_result_quantity_max",
      });
    });

    it("accepts equal min/max (fixed output)", () => {
      const result = parseRecipeInput(
        formDataFrom({
          ...validRecipeEntries(),
          resultQuantityMin: "3",
          resultQuantityMax: "3",
        })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.resultQuantityMin).toBe(3);
        expect(result.value.resultQuantityMax).toBe(3);
      }
    });

    it("accepts a valid range (variable output)", () => {
      const result = parseRecipeInput(
        formDataFrom({
          ...validRecipeEntries(),
          resultQuantityMin: "1",
          resultQuantityMax: "4",
        })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.resultQuantityMin).toBe(1);
        expect(result.value.resultQuantityMax).toBe(4);
      }
    });

    it.each(["0", "-2", "1.5", "many"])(
      "rejects %j as the minimum",
      (value) => {
        const result = parseRecipeInput(
          formDataFrom({
            ...validRecipeEntries(),
            resultQuantityMin: value,
            resultQuantityMax: "4",
          })
        );

        expect(result).toEqual({
          ok: false,
          error: "invalid_result_quantity_min",
        });
      }
    );

    it.each(["0", "-2", "1.5", "many"])(
      "rejects %j as the maximum",
      (value) => {
        const result = parseRecipeInput(
          formDataFrom({
            ...validRecipeEntries(),
            resultQuantityMin: "1",
            resultQuantityMax: value,
          })
        );

        expect(result).toEqual({
          ok: false,
          error: "invalid_result_quantity_max",
        });
      }
    );

    it("rejects a maximum lower than the minimum", () => {
      const result = parseRecipeInput(
        formDataFrom({
          ...validRecipeEntries(),
          resultQuantityMin: "4",
          resultQuantityMax: "1",
        })
      );

      expect(result).toEqual({
        ok: false,
        error: "invalid_result_quantity_range",
      });
    });
  });

  describe("required level", () => {
    it("treats a blank value as null", () => {
      const result = parseRecipeInput(formDataFrom(validRecipeEntries()));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requiredLevel).toBeNull();
      }
    });

    it("accepts zero", () => {
      const result = parseRecipeInput(
        formDataFrom({ ...validRecipeEntries(), requiredLevel: "0" })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requiredLevel).toBe(0);
      }
    });

    it("accepts a positive whole number", () => {
      const result = parseRecipeInput(
        formDataFrom({ ...validRecipeEntries(), requiredLevel: "12" })
      );

      expect(result.ok && result.value.requiredLevel).toBe(12);
    });

    it.each(["-1", "2.5", "soon"])("rejects %j", (value) => {
      const result = parseRecipeInput(
        formDataFrom({ ...validRecipeEntries(), requiredLevel: value })
      );

      expect(result).toEqual({ ok: false, error: "invalid_required_level" });
    });
  });

  describe("ingredient rows", () => {
    it("rejects a submission with no filled ingredient rows", () => {
      const result = parseRecipeInput(
        formDataFrom({
          name: "Iron Ingot",
          resultingItemId: "item-result",
          resultQuantityMin: "1",
          resultQuantityMax: "1",
        })
      );

      expect(result).toEqual({ ok: false, error: "no_ingredients" });
    });

    it("rejects an item selected without a quantity", () => {
      const result = parseRecipeInput(
        formDataFrom({
          name: "Iron Ingot",
          resultingItemId: "item-result",
          resultQuantityMin: "1",
          resultQuantityMax: "1",
          ingredientItemId1: "item-a",
        })
      );

      expect(result).toEqual({ ok: false, error: "incomplete_ingredient" });
    });

    it("rejects a quantity supplied without an item", () => {
      const result = parseRecipeInput(
        formDataFrom({
          name: "Iron Ingot",
          resultingItemId: "item-result",
          resultQuantityMin: "1",
          resultQuantityMax: "1",
          ingredientQuantity1: "2",
        })
      );

      expect(result).toEqual({ ok: false, error: "incomplete_ingredient" });
    });

    it.each(["0", "-3", "1.5", "some"])(
      "rejects the ingredient quantity %j",
      (value) => {
        const result = parseRecipeInput(
          formDataFrom({
            ...validRecipeEntries(),
            ingredientQuantity1: value,
          })
        );

        expect(result).toEqual({ ok: false, error: "invalid_quantity" });
      }
    );

    it("rejects the same ingredient item used twice", () => {
      const result = parseRecipeInput(
        formDataFrom({
          ...validRecipeEntries(),
          ingredientItemId2: "item-a",
          ingredientQuantity2: "1",
        })
      );

      expect(result).toEqual({ ok: false, error: "duplicate_ingredient" });
    });

    it("collects multiple valid ingredients with numeric quantities", () => {
      const result = parseRecipeInput(
        formDataFrom({
          ...validRecipeEntries(),
          ingredientItemId2: "item-b",
          ingredientQuantity2: "5",
        })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ingredients).toEqual([
          { itemId: "item-a", quantity: 2 },
          { itemId: "item-b", quantity: 5 },
        ]);
      }
    });

    it("skips fully blank rows between filled rows", () => {
      const result = parseRecipeInput(
        formDataFrom({
          name: "Iron Ingot",
          resultingItemId: "item-result",
          resultQuantityMin: "1",
          resultQuantityMax: "1",
          ingredientItemId1: "item-a",
          ingredientQuantity1: "1",
          // Row 2 left completely blank on purpose.
          ingredientItemId3: "item-c",
          ingredientQuantity3: "4",
        })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ingredients).toEqual([
          { itemId: "item-a", quantity: 1 },
          { itemId: "item-c", quantity: 4 },
        ]);
      }
    });

    it("only reads the fixed number of ingredient rows", () => {
      const beyondCapacityRow = RECIPE_INGREDIENT_ROW_COUNT + 1;
      const result = parseRecipeInput(
        formDataFrom({
          ...validRecipeEntries(),
          [`ingredientItemId${beyondCapacityRow}`]: "item-extra",
          [`ingredientQuantity${beyondCapacityRow}`]: "9",
        })
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ingredients).toEqual([
          { itemId: "item-a", quantity: 2 },
        ]);
      }
    });
  });
});

// Slice 9C.3: the General editor and the Ingredients tab each parse only
// their own half of the fields, via functions that reuse — never
// re-implement — the exact field/row validation `parseRecipeInput` has
// always used. These tests prove the delegation, not the underlying
// per-field rules already exhaustively covered above.
describe("parseRecipeGeneralInput", () => {
  it("validates every non-ingredient field, ignoring any ingredient rows present", () => {
    const result = parseRecipeGeneralInput(
      formDataFrom({
        ...validRecipeEntries(),
        resultQuantityMin: "1",
        resultQuantityMax: "3",
        professionId: "prof-1",
        requiredLevel: "5",
      })
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Iron Ingot",
        slug: "iron-ingot",
        resultingItemId: "item-result",
        resultQuantityMin: 1,
        resultQuantityMax: 3,
        professionId: "prof-1",
        requiredLevel: 5,
      },
    });
  });

  it("rejects a missing name exactly like the full parser", () => {
    const result = parseRecipeGeneralInput(
      formDataFrom({ name: "  ", resultingItemId: "item-result" })
    );

    expect(result).toEqual({ ok: false, error: "missing_name" });
  });

  it("succeeds with no ingredient rows at all — ingredients are not its concern", () => {
    const result = parseRecipeGeneralInput(
      formDataFrom({
        name: "Iron Ingot",
        resultingItemId: "item-result",
        resultQuantityMin: "1",
        resultQuantityMax: "1",
      })
    );

    expect(result.ok).toBe(true);
  });
});

describe("parseRecipeIngredientsInput", () => {
  it("collects valid ingredient rows, ignoring any non-ingredient fields present", () => {
    const result = parseRecipeIngredientsInput(
      formDataFrom({ ...validRecipeEntries(), name: "Ignored Name" })
    );

    expect(result).toEqual({
      ok: true,
      value: { ingredients: [{ itemId: "item-a", quantity: 2 }] },
    });
  });

  it("rejects a submission with no filled ingredient rows exactly like the full parser", () => {
    const result = parseRecipeIngredientsInput(formDataFrom({}));

    expect(result).toEqual({ ok: false, error: "no_ingredients" });
  });

  it("rejects the same ingredient item used twice", () => {
    const result = parseRecipeIngredientsInput(
      formDataFrom({
        ingredientItemId1: "item-a",
        ingredientQuantity1: "1",
        ingredientItemId2: "item-a",
        ingredientQuantity2: "2",
      })
    );

    expect(result).toEqual({ ok: false, error: "duplicate_ingredient" });
  });

  it("succeeds with no name or resulting item at all — those are not its concern", () => {
    const result = parseRecipeIngredientsInput(
      formDataFrom({ ingredientItemId1: "item-a", ingredientQuantity1: "1" })
    );

    expect(result.ok).toBe(true);
  });
});
