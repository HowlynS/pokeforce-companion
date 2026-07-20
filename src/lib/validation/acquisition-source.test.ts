import { describe, expect, it } from "vitest";
import {
  ACQUISITION_TYPES,
  ACQUISITION_TYPE_LABELS,
  buildAcquisitionSourceCard,
  groupAcquisitionSourcesByType,
  groupObtainableItemsByType,
  parseAcquisitionSourceInput,
  type AcquisitionSourceForDisplay,
  type AcquisitionSourceForLocationDisplay,
} from "@/lib/validation/acquisition-source";

function source(
  overrides: Partial<AcquisitionSourceForDisplay> & { id: string }
): AcquisitionSourceForDisplay {
  return {
    type: "OTHER",
    sourceLabel: null,
    quantity: null,
    notes: null,
    location: null,
    profession: null,
    ...overrides,
  };
}

function locationSource(
  overrides: Partial<AcquisitionSourceForLocationDisplay> & {
    item: AcquisitionSourceForLocationDisplay["item"];
  }
): AcquisitionSourceForLocationDisplay {
  return {
    type: "OTHER",
    sourceLabel: null,
    quantity: null,
    notes: null,
    profession: null,
    ...overrides,
  };
}

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("ACQUISITION_TYPE_LABELS", () => {
  it("has exactly one label per acquisition type, in the same order", () => {
    expect(Object.keys(ACQUISITION_TYPE_LABELS)).toEqual([
      ...ACQUISITION_TYPES,
    ]);
  });

  it("gives every type a non-empty, distinct label", () => {
    const labels = ACQUISITION_TYPES.map(
      (type) => ACQUISITION_TYPE_LABELS[type]
    );
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("uses the required display wording for NPC or shop", () => {
    expect(ACQUISITION_TYPE_LABELS.NPC_OR_SHOP).toBe("NPC or shop");
  });
});

describe("parseAcquisitionSourceInput", () => {
  it("rejects a missing type", () => {
    const result = parseAcquisitionSourceInput(formDataFrom({}));

    expect(result).toEqual({ ok: false, error: "missing_type" });
  });

  it("rejects a type outside the fixed enum", () => {
    const result = parseAcquisitionSourceInput(
      formDataFrom({ type: "NOT_A_REAL_TYPE" })
    );

    expect(result).toEqual({ ok: false, error: "invalid_type" });
  });

  it("accepts every declared acquisition type", () => {
    for (const type of ACQUISITION_TYPES) {
      const result = parseAcquisitionSourceInput(formDataFrom({ type }));
      expect(result.ok && result.value.type).toBe(type);
    }
  });

  it("parses the minimal valid input with every optional field null", () => {
    const result = parseAcquisitionSourceInput(
      formDataFrom({ type: "FORAGING" })
    );

    expect(result).toEqual({
      ok: true,
      value: {
        type: "FORAGING",
        locationId: null,
        professionId: null,
        sourceLabel: null,
        notes: null,
        quantity: null,
      },
    });
  });

  it("trims optional text fields and stores blank ones as null", () => {
    const withText = parseAcquisitionSourceInput(
      formDataFrom({
        type: "NPC_OR_SHOP",
        locationId: " loc123 ",
        professionId: " prof123 ",
        sourceLabel: " Seed Merchant ",
        notes: " Sells only at night. ",
        quantity: " 1-3 ",
      })
    );

    expect(withText.ok).toBe(true);
    if (withText.ok) {
      expect(withText.value.locationId).toBe("loc123");
      expect(withText.value.professionId).toBe("prof123");
      expect(withText.value.sourceLabel).toBe("Seed Merchant");
      expect(withText.value.notes).toBe("Sells only at night.");
      expect(withText.value.quantity).toBe("1-3");
    }

    const withBlank = parseAcquisitionSourceInput(
      formDataFrom({
        type: "NPC_OR_SHOP",
        sourceLabel: "  ",
        notes: "  ",
        quantity: "  ",
      })
    );

    expect(withBlank.ok).toBe(true);
    if (withBlank.ok) {
      expect(withBlank.value.locationId).toBeNull();
      expect(withBlank.value.professionId).toBeNull();
      expect(withBlank.value.sourceLabel).toBeNull();
      expect(withBlank.value.notes).toBeNull();
      expect(withBlank.value.quantity).toBeNull();
    }
  });

  it("accepts a source label without any named NPC record (free text only)", () => {
    const result = parseAcquisitionSourceInput(
      formDataFrom({ type: "NPC_OR_SHOP", sourceLabel: "Vendor on Route 4" })
    );

    expect(result.ok && result.value.sourceLabel).toBe("Vendor on Route 4");
  });
});

describe("groupAcquisitionSourcesByType", () => {
  it("returns no groups for an empty source list", () => {
    expect(groupAcquisitionSourcesByType([])).toEqual([]);
  });

  it("omits any type with zero sources", () => {
    const groups = groupAcquisitionSourcesByType([
      source({ id: "1", type: "MINING" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("MINING");
    expect(groups[0].label).toBe(ACQUISITION_TYPE_LABELS.MINING);
  });

  it("orders groups by the enum's declared order, not input order", () => {
    // FORAGING is declared before SMITHING in ACQUISITION_TYPES; supplying
    // them in the opposite order must not change the group order.
    const groups = groupAcquisitionSourcesByType([
      source({ id: "1", type: "SMITHING" }),
      source({ id: "2", type: "FORAGING" }),
    ]);

    expect(groups.map((group) => group.type)).toEqual(["FORAGING", "SMITHING"]);
    expect(
      ACQUISITION_TYPES.indexOf("FORAGING") < ACQUISITION_TYPES.indexOf("SMITHING")
    ).toBe(true);
  });

  it("keeps every source of the same type, in the given order", () => {
    const groups = groupAcquisitionSourcesByType([
      source({ id: "1", type: "MINING" }),
      source({ id: "2", type: "MINING" }),
      source({ id: "3", type: "MINING" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sources.map((entry) => entry.id)).toEqual(["1", "2", "3"]);
  });
});

describe("buildAcquisitionSourceCard", () => {
  it("falls back to the type label when nothing else is populated", () => {
    const card = buildAcquisitionSourceCard(source({ id: "1", type: "EVENT" }));

    expect(card.title).toBe("Event");
    expect(card.description).toBe("");
    expect(card.href).toBeUndefined();
  });

  it("prefers the location as the title and link target over everything else", () => {
    const card = buildAcquisitionSourceCard(
      source({
        id: "1",
        type: "FISHING",
        location: { name: "Quiet Pond", slug: "quiet-pond" },
        sourceLabel: "Old Pier",
        profession: { name: "Fishing" },
        quantity: "1",
        notes: "Best at dawn.",
      })
    );

    expect(card.title).toBe("Quiet Pond");
    expect(card.href).toBe("/locations/quiet-pond");
    // Nothing that became the title is repeated, but every other populated
    // fact still appears.
    expect(card.description).toContain("Source: Old Pier");
    expect(card.description).toContain("Profession: Fishing");
    expect(card.description).toContain("Quantity: 1");
    expect(card.description).toContain("Notes: Best at dawn.");
  });

  it("uses the source label as the title when there is no location", () => {
    const card = buildAcquisitionSourceCard(
      source({ id: "1", type: "NPC_OR_SHOP", sourceLabel: "Seed Merchant" })
    );

    expect(card.title).toBe("Seed Merchant");
    expect(card.href).toBeUndefined();
    // The label is not also repeated in the description.
    expect(card.description).not.toContain("Seed Merchant");
  });

  it("uses the profession as the title when there is no location or label", () => {
    const card = buildAcquisitionSourceCard(
      source({
        id: "1",
        type: "COOKING",
        profession: { name: "Cooking" },
        quantity: "2",
      })
    );

    expect(card.title).toBe("Cooking");
    expect(card.description).toBe("Quantity: 2");
  });

  it("never shows an empty labelled fact for an unset field", () => {
    const card = buildAcquisitionSourceCard(
      source({ id: "1", type: "REWARD", quantity: "1" })
    );

    expect(card.description).toBe("Quantity: 1");
    expect(card.description).not.toMatch(/Profession:\s*(·|$)/);
    expect(card.description).not.toMatch(/Notes:\s*(·|$)/);
    expect(card.description).not.toMatch(/Source:\s*(·|$)/);
  });
});

describe("groupObtainableItemsByType", () => {
  const ironOre = { slug: "iron-ore", name: "Iron Ore", image: null };
  const copperOre = { slug: "copper-ore", name: "Copper Ore", image: null };

  it("returns no groups for an empty source list", () => {
    expect(groupObtainableItemsByType([])).toEqual([]);
  });

  it("omits any type with zero matching items", () => {
    const groups = groupObtainableItemsByType([
      locationSource({ type: "MINING", item: ironOre }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("MINING");
    expect(groups[0].label).toBe(ACQUISITION_TYPE_LABELS.MINING);
  });

  it("orders groups by the enum's declared order, not input order", () => {
    // FORAGING is declared before SMITHING in ACQUISITION_TYPES; supplying
    // them in the opposite order must not change the group order.
    const groups = groupObtainableItemsByType([
      locationSource({ type: "SMITHING", item: ironOre }),
      locationSource({ type: "FORAGING", item: copperOre }),
    ]);

    expect(groups.map((group) => group.type)).toEqual(["FORAGING", "SMITHING"]);
    expect(
      ACQUISITION_TYPES.indexOf("FORAGING") < ACQUISITION_TYPES.indexOf("SMITHING")
    ).toBe(true);
  });

  it("orders items within a group by name ascending, regardless of input order", () => {
    const groups = groupObtainableItemsByType([
      locationSource({ type: "MINING", item: ironOre }),
      locationSource({ type: "MINING", item: copperOre }),
    ]);

    expect(groups[0].items.map((entry) => entry.item.name)).toEqual([
      "Copper Ore",
      "Iron Ore",
    ]);
  });

  it("uses slug as a stable tie-breaker when two items share a name", () => {
    const groups = groupObtainableItemsByType([
      locationSource({
        type: "MINING",
        item: { slug: "iron-ore-b", name: "Same Name", image: null },
      }),
      locationSource({
        type: "MINING",
        item: { slug: "iron-ore-a", name: "Same Name", image: null },
      }),
    ]);

    expect(groups[0].items.map((entry) => entry.item.slug)).toEqual([
      "iron-ore-a",
      "iron-ore-b",
    ]);
  });

  it("collapses repeated sources for the same item into one card", () => {
    const groups = groupObtainableItemsByType([
      locationSource({ type: "MINING", item: ironOre, notes: "Common." }),
      locationSource({ type: "MINING", item: ironOre, notes: "Rare vein." }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].item.slug).toBe("iron-ore");
  });

  it("keeps every distinct populated fact combination on the one collapsed card", () => {
    const groups = groupObtainableItemsByType([
      locationSource({ type: "MINING", item: ironOre, notes: "Common." }),
      locationSource({ type: "MINING", item: ironOre, notes: "Rare vein." }),
    ]);

    expect(groups[0].items[0].description).toContain("Notes: Common.");
    expect(groups[0].items[0].description).toContain("Notes: Rare vein.");
  });

  it("collapses an exact duplicate fact combination instead of repeating it", () => {
    const groups = groupObtainableItemsByType([
      locationSource({ type: "MINING", item: ironOre, quantity: "1-2" }),
      locationSource({ type: "MINING", item: ironOre, quantity: "1-2" }),
    ]);

    const description = groups[0].items[0].description;
    expect(description).toBe("Quantity: 1-2");
    expect(description.match(/Quantity: 1-2/g)).toHaveLength(1);
  });

  it("yields an empty description when nothing is populated on any source", () => {
    const groups = groupObtainableItemsByType([
      locationSource({ type: "EVENT", item: ironOre }),
      locationSource({ type: "EVENT", item: ironOre }),
    ]);

    expect(groups[0].items[0].description).toBe("");
  });

  it("lets the same item appear in different type groups for genuinely different methods", () => {
    const groups = groupObtainableItemsByType([
      locationSource({ type: "MINING", item: ironOre }),
      locationSource({ type: "FORAGING", item: ironOre }),
    ]);

    expect(groups.map((group) => group.type)).toEqual(["FORAGING", "MINING"]);
    expect(groups[0].items[0].item.slug).toBe("iron-ore");
    expect(groups[1].items[0].item.slug).toBe("iron-ore");
  });

  it("includes profession and source label facts alongside quantity and notes", () => {
    const groups = groupObtainableItemsByType([
      locationSource({
        type: "COOKING",
        item: ironOre,
        sourceLabel: "Camp Kitchen",
        profession: { name: "Cooking" },
        quantity: "1-2",
        notes: "Requires a lit campfire.",
      }),
    ]);

    const description = groups[0].items[0].description;
    expect(description).toContain("Source: Camp Kitchen");
    expect(description).toContain("Profession: Cooking");
    expect(description).toContain("Quantity: 1-2");
    expect(description).toContain("Notes: Requires a lit campfire.");
  });
});
