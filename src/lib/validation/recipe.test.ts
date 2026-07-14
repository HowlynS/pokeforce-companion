import { describe, expect, it } from "vitest";
import {
  RECIPE_INGREDIENT_ROW_COUNT,
  normalizeSlug,
  parseRecipeInput,
} from "@/lib/validation/recipe";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

// A minimal valid submission: name, a resulting item, and one ingredient row.
function validRecipeEntries(): Record<string, string> {
  return {
    name: "Iron Ingot",
    resultingItemId: "item-result",
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

  describe("resulting quantity", () => {
    it("defaults to 1 when blank", () => {
      const result = parseRecipeInput(formDataFrom(validRecipeEntries()));

      expect(result.ok && result.value.resultingQuantity).toBe(1);
    });

    it("accepts a positive whole number", () => {
      const result = parseRecipeInput(
        formDataFrom({ ...validRecipeEntries(), resultingQuantity: "3" })
      );

      expect(result.ok && result.value.resultingQuantity).toBe(3);
    });

    it.each(["0", "-2", "1.5", "many"])(
      "rejects %j",
      (value) => {
        const result = parseRecipeInput(
          formDataFrom({ ...validRecipeEntries(), resultingQuantity: value })
        );

        expect(result).toEqual({
          ok: false,
          error: "invalid_resulting_quantity",
        });
      }
    );
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
        formDataFrom({ name: "Iron Ingot", resultingItemId: "item-result" })
      );

      expect(result).toEqual({ ok: false, error: "no_ingredients" });
    });

    it("rejects an item selected without a quantity", () => {
      const result = parseRecipeInput(
        formDataFrom({
          name: "Iron Ingot",
          resultingItemId: "item-result",
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
