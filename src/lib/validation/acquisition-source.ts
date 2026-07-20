// Mirrors the Prisma AcquisitionType enum exactly; kept here (not imported
// from the generated client) so this module stays a plain, dependency-free
// parser like the other validation files.
export const ACQUISITION_TYPES = [
  "FORAGING",
  "FISHING",
  "FARMING",
  "CRAFTING",
  "MINING",
  "ARCHAEOLOGY",
  "COOKING",
  "CONSTRUCTION",
  "SMITHING",
  "NPC_OR_SHOP",
  "ENEMY_DROP",
  "REWARD",
  "CONTAINER",
  "EXCHANGE",
  "EVENT",
  "OTHER",
] as const;

export type AcquisitionType = (typeof ACQUISITION_TYPES)[number];

// Admin- and public-facing display labels for each type.
export const ACQUISITION_TYPE_LABELS: Record<AcquisitionType, string> = {
  FORAGING: "Foraging",
  FISHING: "Fishing",
  FARMING: "Farming",
  CRAFTING: "Crafting",
  MINING: "Mining",
  ARCHAEOLOGY: "Archaeology",
  COOKING: "Cooking",
  CONSTRUCTION: "Construction",
  SMITHING: "Smithing",
  NPC_OR_SHOP: "NPC or shop",
  ENEMY_DROP: "Enemy drop",
  REWARD: "Reward",
  CONTAINER: "Container",
  EXCHANGE: "Exchange",
  EVENT: "Event",
  OTHER: "Other",
};

export type AcquisitionSourceInput = {
  type: AcquisitionType;
  locationId: string | null;
  professionId: string | null;
  sourceLabel: string | null;
  notes: string | null;
  // Deliberately a single free-text field — restrained by design. No drop
  // rates, no min/max, no structured conditions: "1-3" or "Rare drop" are
  // both valid, equally untyped strings.
  quantity: string | null;
};

export type AcquisitionSourceValidationError = "missing_type" | "invalid_type";

export type AcquisitionSourceParseResult =
  | { ok: true; value: AcquisitionSourceInput }
  | { ok: false; error: AcquisitionSourceValidationError };

function isAcquisitionType(value: string): value is AcquisitionType {
  return (ACQUISITION_TYPES as readonly string[]).includes(value);
}

// --- Public display helpers -------------------------------------------
//
// Pure, presentation-only helpers for the item detail page's "How to
// obtain" section. Grouping and card-building never invent priority or
// completeness semantics: the group order is simply the enum's declared
// order (any type with zero sources is omitted entirely), and within a
// group the caller's own ordering (createdAt ascending) is preserved.

export type AcquisitionSourceForDisplay = {
  id: string;
  type: AcquisitionType;
  sourceLabel: string | null;
  quantity: string | null;
  notes: string | null;
  location: { name: string; slug: string } | null;
  profession: { name: string } | null;
};

export type AcquisitionSourceGroup = {
  type: AcquisitionType;
  label: string;
  sources: AcquisitionSourceForDisplay[];
};

/**
 * Groups sources by type in the enum's declared order, omitting any type
 * with no sources. Never reorders sources within a group — the caller
 * supplies them in the order to preserve (createdAt ascending).
 */
export function groupAcquisitionSourcesByType(
  sources: readonly AcquisitionSourceForDisplay[]
): AcquisitionSourceGroup[] {
  return ACQUISITION_TYPES.map((type) => ({
    type,
    label: ACQUISITION_TYPE_LABELS[type],
    sources: sources.filter((source) => source.type === type),
  })).filter((group) => group.sources.length > 0);
}

// --- Public Location "Obtainable Items" helpers (Slice 10A) ------------
//
// The mirror image of the Item page's "How to obtain" section above: here
// the caller already knows the Location (it is the page itself), and the
// section instead lists every ITEM obtainable there. Reuses the same
// canonical ACQUISITION_TYPES order and ACQUISITION_TYPE_LABELS map — no
// second ordering or label map. The one genuinely new concern is that a
// single Item can have more than one Acquisition Source of the same type
// at the same Location (e.g. two MINING rows with different notes), and
// the section must render ONE card per Item, not one per source row.

export type AcquisitionSourceForLocationDisplay = {
  type: AcquisitionType;
  sourceLabel: string | null;
  quantity: string | null;
  notes: string | null;
  profession: { name: string } | null;
  item: { slug: string; name: string; image: string | null };
};

export type ObtainableItemCard = {
  item: { slug: string; name: string; image: string | null };
  /** Every DISTINCT populated fact combination across this Item's
      sources of this type at this Location, joined for display — an
      exact duplicate combination collapses instead of repeating; an
      Item with nothing populated on any of its sources yields "". */
  description: string;
};

export type ObtainableItemGroup = {
  type: AcquisitionType;
  label: string;
  items: ObtainableItemCard[];
};

/**
 * Groups a Location's Acquisition Sources into the public "Obtainable
 * Items" section: type groups in the enum's declared order (any type
 * with no matching Item omitted entirely), and within each group one
 * card per distinct Item ordered by name ascending (slug as a stable
 * tie-breaker) — never one card per source row, and never reliant on
 * the caller's own input order. The same Item may appear in more than
 * one type group when it is genuinely obtainable more than one way.
 */
export function groupObtainableItemsByType(
  sources: readonly AcquisitionSourceForLocationDisplay[]
): ObtainableItemGroup[] {
  return ACQUISITION_TYPES.map((type) => {
    const itemsBySlug = new Map<
      string,
      { item: AcquisitionSourceForLocationDisplay["item"]; factLines: Set<string> }
    >();

    for (const source of sources) {
      if (source.type !== type) {
        continue;
      }

      const facts: string[] = [];
      if (source.sourceLabel) {
        facts.push(`Source: ${source.sourceLabel}`);
      }
      if (source.profession) {
        facts.push(`Profession: ${source.profession.name}`);
      }
      if (source.quantity) {
        facts.push(`Quantity: ${source.quantity}`);
      }
      if (source.notes) {
        facts.push(`Notes: ${source.notes}`);
      }
      const factLine = facts.join(" · ");

      const existing = itemsBySlug.get(source.item.slug);
      if (existing) {
        if (factLine) {
          existing.factLines.add(factLine);
        }
      } else {
        const factLines = new Set<string>();
        if (factLine) {
          factLines.add(factLine);
        }
        itemsBySlug.set(source.item.slug, { item: source.item, factLines });
      }
    }

    const items: ObtainableItemCard[] = Array.from(itemsBySlug.values())
      .map(({ item, factLines }) => ({
        item,
        description: Array.from(factLines).join("; "),
      }))
      .sort((a, b) => {
        if (a.item.name !== b.item.name) {
          return a.item.name < b.item.name ? -1 : 1;
        }
        return a.item.slug < b.item.slug ? -1 : a.item.slug > b.item.slug ? 1 : 0;
      });

    return { type, label: ACQUISITION_TYPE_LABELS[type], items };
  }).filter((group) => group.items.length > 0);
}

/**
 * Builds one source's card content. The title is the strongest available
 * identifying fact (location, then source label, then profession, then
 * finally the type label itself, which is never blank) so a card is never
 * titled with empty text; the description holds every OTHER populated
 * fact, so nothing is shown twice. The location — and only the location,
 * per the confirmed scope — becomes the card's link target.
 */
export function buildAcquisitionSourceCard(
  source: AcquisitionSourceForDisplay
): { title: string; description: string; href?: string } {
  const title =
    source.location?.name ??
    source.sourceLabel ??
    source.profession?.name ??
    ACQUISITION_TYPE_LABELS[source.type];

  const facts: string[] = [];

  if (source.sourceLabel && title !== source.sourceLabel) {
    facts.push(`Source: ${source.sourceLabel}`);
  }
  if (source.profession && title !== source.profession.name) {
    facts.push(`Profession: ${source.profession.name}`);
  }
  if (source.quantity) {
    facts.push(`Quantity: ${source.quantity}`);
  }
  if (source.notes) {
    facts.push(`Notes: ${source.notes}`);
  }

  return {
    title,
    description: facts.join(" · "),
    href: source.location ? `/locations/${source.location.slug}` : undefined,
  };
}

export function parseAcquisitionSourceInput(
  formData: FormData
): AcquisitionSourceParseResult {
  const rawType = String(formData.get("type") ?? "").trim();
  const rawLocationId = String(formData.get("locationId") ?? "").trim();
  const rawProfessionId = String(formData.get("professionId") ?? "").trim();
  const sourceLabel = String(formData.get("sourceLabel") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim();

  if (!rawType) {
    return { ok: false, error: "missing_type" };
  }

  if (!isAcquisitionType(rawType)) {
    return { ok: false, error: "invalid_type" };
  }

  return {
    ok: true,
    value: {
      type: rawType,
      locationId: rawLocationId || null,
      professionId: rawProfessionId || null,
      sourceLabel: sourceLabel || null,
      notes: notes || null,
      quantity: quantity || null,
    },
  };
}
