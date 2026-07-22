import { describe, expect, it } from "vitest";
import { formatRecipeProduces, formatRecipeQuantityRange } from "./recipe-quantity";

describe("formatRecipeQuantityRange", () => {
  it("shows a single number when min and max are equal (fixed output)", () => {
    expect(formatRecipeQuantityRange(1, 1)).toBe("1");
    expect(formatRecipeQuantityRange(3, 3)).toBe("3");
  });

  it("shows an en-dash range when min and max differ (variable output)", () => {
    expect(formatRecipeQuantityRange(1, 4)).toBe("1–4");
    expect(formatRecipeQuantityRange(2, 5)).toBe("2–5");
  });

  it("never renders a redundant 1-1 style range", () => {
    expect(formatRecipeQuantityRange(1, 1)).not.toContain("–");
  });
});

describe("formatRecipeProduces", () => {
  it("prefixes the bare range with the required 'Produces' wording", () => {
    expect(formatRecipeProduces(1, 1)).toBe("Produces 1");
    expect(formatRecipeProduces(3, 3)).toBe("Produces 3");
    expect(formatRecipeProduces(1, 4)).toBe("Produces 1–4");
    expect(formatRecipeProduces(2, 5)).toBe("Produces 2–5");
  });
});
