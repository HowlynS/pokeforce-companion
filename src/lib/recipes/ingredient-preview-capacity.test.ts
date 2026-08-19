import { describe, expect, it } from "vitest";
import { resolveIngredientCapacity } from "@/lib/recipes/ingredient-preview-capacity";

// The canonical grid card's measured geometry at the 1920 anchor.
const grid = { cellWidth: 36, gap: 6, triggerWidth: 24 };
// The /recipes directory card's own measured geometry.
const directoryGrid = { cellWidth: 36, gap: 9, triggerWidth: 25 };

describe("resolveIngredientCapacity", () => {
  it("shows every ingredient and no trigger when the whole set fits", () => {
    // 4 cells need 4*36 + 3*6 = 162px.
    expect(
      resolveIngredientCapacity({ ...grid, available: 202, total: 4 })
    ).toEqual({ visible: 4, showTrigger: false });
  });

  it("reserves the trigger's own cell once the set overflows", () => {
    // 202px holds 4 cells bare (162px), and still 4 once 24 + 6 is reserved
    // (162 <= 172) -- so this strip shows one MORE preview than the fixed
    // budget it replaced, which is the whole point of measuring.
    expect(
      resolveIngredientCapacity({ ...grid, available: 202, total: 9 })
    ).toEqual({ visible: 4, showTrigger: true });
    // A narrower strip of the same card genuinely only holds 3.
    expect(
      resolveIngredientCapacity({ ...grid, available: 175, total: 9 })
    ).toEqual({ visible: 3, showTrigger: true });
  });

  it("fits more previews in a wider strip at identical cell geometry", () => {
    const narrow = resolveIngredientCapacity({
      ...grid,
      available: 202,
      total: 9,
    });
    const wide = resolveIngredientCapacity({
      ...grid,
      available: 320,
      total: 9,
    });
    expect(wide.visible).toBeGreaterThan(narrow.visible);
    expect(wide.showTrigger).toBe(true);
  });

  it("counts only COMPLETE cells, never a clipped one", () => {
    // 200px would hold 4.9 bare cells; the fifth is not rendered at all.
    expect(
      resolveIngredientCapacity({ ...grid, available: 200, total: 8 }).visible
    ).toBeLessThanOrEqual(4);
    // One pixel short of a 4th complete cell still yields 3.
    expect(
      resolveIngredientCapacity({
        ...grid,
        available: 4 * 36 + 3 * 6 - 1,
        total: 8,
        triggerWidth: 0,
        gap: 6,
      }).visible
    ).toBe(3);
  });

  it("uses the directory card's own wider gap and trigger", () => {
    // 164px at gap 9 holds 3 bare cells (3*36 + 2*9 = 126, 4 would need 171).
    expect(
      resolveIngredientCapacity({
        ...directoryGrid,
        available: 164,
        total: 3,
      })
    ).toEqual({ visible: 3, showTrigger: false });
    // Reserving 25 + 9 leaves 130px, which still holds 3 complete cells.
    expect(
      resolveIngredientCapacity({
        ...directoryGrid,
        available: 164,
        total: 6,
      })
    ).toEqual({ visible: 3, showTrigger: true });
  });

  it("drops the trigger again when reserving it was what caused the overflow", () => {
    // 3 cells fit bare (126 <= 130) but reserving the trigger leaves room for
    // 2 — so the honest answer is to show all 3 and no trigger.
    expect(
      resolveIngredientCapacity({
        ...directoryGrid,
        available: 130,
        total: 3,
      })
    ).toEqual({ visible: 3, showTrigger: false });
  });

  it("never renders a strip of nothing but a chevron", () => {
    const result = resolveIngredientCapacity({
      ...grid,
      available: 30,
      total: 6,
    });
    expect(result.visible).toBe(1);
    expect(result.showTrigger).toBe(true);
  });

  it("handles a Recipe with no ingredients at all", () => {
    expect(
      resolveIngredientCapacity({ ...grid, available: 202, total: 0 })
    ).toEqual({ visible: 0, showTrigger: false });
  });
});
