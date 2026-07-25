import { describe, expect, it } from "vitest";
import {
  SHOP_CREATE_PATH,
  SHOP_LIST_PATH,
  buildShopLocationOptions,
  describeShopListings,
  normalizeShopSearchQuery,
  shopCanDelete,
  shopEditHref,
  shopEditorTabs,
  shopInventoryHref,
} from "@/lib/admin/shop-workspace";

describe("Shop workspace routes", () => {
  it("builds list, create, edit, and Inventory routes", () => {
    expect(SHOP_LIST_PATH).toBe("/admin/shops");
    expect(SHOP_CREATE_PATH).toBe("/admin/shops/new");
    expect(shopEditHref("blackthorn-supply", "supply")).toBe(
      "/admin/shops/blackthorn-supply/edit?q=supply"
    );
    expect(shopInventoryHref("blackthorn-supply")).toBe(
      "/admin/shops/blackthorn-supply/inventory"
    );
    expect(normalizeShopSearchQuery("  supply ")).toBe("supply");
  });

  it("keeps Inventory visible but disabled until its slice", () => {
    expect(shopEditorTabs("shop", "", "general", 3, false)).toEqual([
      {
        label: "General",
        href: "/admin/shops/shop/edit",
        active: true,
      },
      {
        label: "Inventory",
        href: "/admin/shops/shop/inventory",
        active: false,
        disabled: true,
        count: 3,
      },
    ]);
  });
});

describe("Shop Location selector options", () => {
  it("renders deterministic root-to-leaf context and preserves images", () => {
    expect(
      buildShopLocationOptions([
        { id: "child", name: "Market", parentId: "town", imageUrl: "child.png" },
        { id: "region", name: "North", parentId: null },
        { id: "town", name: "Blackthorn", parentId: "region" },
      ])
    ).toEqual([
      { value: "region", label: "North", imageUrl: null },
      { value: "town", label: "North › Blackthorn", imageUrl: null },
      {
        value: "child",
        label: "North › Blackthorn › Market",
        imageUrl: "child.png",
      },
    ]);
  });

  it("stays cycle-defensive for malformed hierarchy input", () => {
    const options = buildShopLocationOptions([
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" },
    ]);
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.label.length > 0)).toBe(true);
  });
});

describe("Shop deletion safeguards", () => {
  it("blocks Shops with Inventory", () => {
    expect(shopCanDelete(0)).toBe(true);
    expect(shopCanDelete(2)).toBe(false);
    expect(describeShopListings(1)).toBe("1 inventory listing");
    expect(describeShopListings(2)).toBe("2 inventory listings");
  });
});
