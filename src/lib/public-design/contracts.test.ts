import { describe, expect, it } from "vitest";
import {
  PUBLIC_DESIGN_CONTRACTS,
  assertValidPublicDesignContracts,
  resolvePublicDesignRoute,
} from "@/lib/public-design/contracts";
import { getPublicDesignFixture } from "@/lib/public-design/fixtures";

describe("public design contracts", () => {
  it("validates every contract, fixture, route, family, and viewport", () => {
    expect(() => assertValidPublicDesignContracts()).not.toThrow();
    expect(new Set(PUBLIC_DESIGN_CONTRACTS.map(({ id }) => id)).size).toBe(
      PUBLIC_DESIGN_CONTRACTS.length
    );
  });

  it("resolves only fixtures allowlisted by their contract", () => {
    const contract = PUBLIC_DESIGN_CONTRACTS.find(({ id }) => id === "item-detail");
    const catalogue = PUBLIC_DESIGN_CONTRACTS.find(
      ({ id }) => id === "items-index"
    );
    const fixture = getPublicDesignFixture("item-dense");
    const sparseCatalogue = getPublicDesignFixture("items-sparse");
    const wrongFixture = getPublicDesignFixture("shop-sparse");
    expect(contract).toBeDefined();
    expect(catalogue).toBeDefined();
    expect(fixture).toBeDefined();
    expect(sparseCatalogue).toBeDefined();
    expect(wrongFixture).toBeDefined();
    expect(resolvePublicDesignRoute(contract!, fixture!)).toBe(
      "/items/design-review-item-dense"
    );
    expect(resolvePublicDesignRoute(catalogue!, sparseCatalogue!)).toBe(
      "/items?category=design-review-category-sparse"
    );
    expect(() => resolvePublicDesignRoute(contract!, wrongFixture!)).toThrow(
      /not registered/
    );
  });
});
