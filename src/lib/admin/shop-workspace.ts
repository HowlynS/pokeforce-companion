import type { AdminSelectOption } from "@/components/admin/admin-select";
import type { EditorTab } from "@/components/admin/editor-tabs";

export const SHOP_LIST_PATH = "/admin/shops";
export const SHOP_CREATE_PATH = "/admin/shops/new";

export function normalizeShopSearchQuery(
  rawQuery: string | null | undefined
): string {
  return rawQuery?.trim() ?? "";
}

export function withShopSearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }
  return `${path}?${new URLSearchParams({ q: query }).toString()}`;
}

export function shopEditHref(slug: string, query = ""): string {
  return withShopSearchQuery(
    `/admin/shops/${encodeURIComponent(slug)}/edit`,
    query
  );
}

export function shopInventoryHref(slug: string, query = ""): string {
  return withShopSearchQuery(
    `/admin/shops/${encodeURIComponent(slug)}/inventory`,
    query
  );
}

export function shopEditorTabs(
  slug: string,
  query: string,
  active: "general" | "inventory",
  listingCount: number,
  inventoryEnabled = false
): EditorTab[] {
  return [
    {
      label: "General",
      href: shopEditHref(slug, query),
      active: active === "general",
    },
    {
      label: "Inventory",
      href: shopInventoryHref(slug, query),
      active: active === "inventory",
      disabled: !inventoryEnabled,
      count: listingCount,
    },
  ];
}

export function shopCanDelete(listingCount: number): boolean {
  return listingCount === 0;
}

export function describeShopListings(count: number): string {
  return count === 1 ? "1 inventory listing" : `${count} inventory listings`;
}

type LocationForOption = {
  id: string;
  name: string;
  parentId: string | null;
  imageUrl?: string | null;
};

/** Builds root-to-leaf labels from one already-loaded Location collection. */
export function buildShopLocationOptions(
  locations: readonly LocationForOption[]
): AdminSelectOption[] {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const labelCache = new Map<string, string>();

  function labelFor(id: string, visited = new Set<string>()): string {
    const cached = labelCache.get(id);
    if (cached) {
      return cached;
    }

    const location = byId.get(id);
    if (!location || visited.has(id)) {
      return location?.name ?? id;
    }

    visited.add(id);
    const label =
      location.parentId && byId.has(location.parentId)
        ? `${labelFor(location.parentId, visited)} › ${location.name}`
        : location.name;
    labelCache.set(id, label);
    return label;
  }

  return locations
    .map((location) => ({
      value: location.id,
      label: labelFor(location.id),
      imageUrl: location.imageUrl ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}
