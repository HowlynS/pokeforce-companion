import { describe, expect, it } from "vitest";
import {
  PUBLIC_DESIGN_ACCEPTANCE_MATRIX,
  validatePublicDesignAcceptanceMatrix,
} from "@/lib/public-design/acceptance";
import { PUBLIC_DESIGN_CONTRACTS } from "@/lib/public-design/contracts";

describe("public design acceptance matrix", () => {
  it("contains one valid entry for every contract viewport", () => {
    expect(validatePublicDesignAcceptanceMatrix()).toEqual([]);
    expect(PUBLIC_DESIGN_ACCEPTANCE_MATRIX).toHaveLength(
      PUBLIC_DESIGN_CONTRACTS.reduce(
        (total, contract) => total + contract.viewports.length,
        0
      )
    );
  });

  it("records responsive sidebar and scenic expectations", () => {
    expect(
      PUBLIC_DESIGN_ACCEPTANCE_MATRIX.find(
        ({ id }) => id === "item-detail--item-dense--mobile-390"
      )
    ).toMatchObject({ scenicBackground: "present", sidebarMode: "stacked" });
    expect(
      PUBLIC_DESIGN_ACCEPTANCE_MATRIX.find(
        ({ id }) => id === "recipe-detail--recipe-many-ingredients--desktop-1920"
      )
    ).toMatchObject({ scenicBackground: "absent", sidebarMode: "side-by-side" });
  });
});
