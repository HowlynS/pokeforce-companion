import type { EditorTab } from "@/components/admin/editor-tabs";

export const CURRENCY_LIST_PATH = "/admin/settings/currencies";
export const CURRENCY_CREATE_PATH = `${CURRENCY_LIST_PATH}/new`;

export function normalizeCurrencySearchQuery(
  rawQuery: string | null | undefined
): string {
  return rawQuery?.trim() ?? "";
}

export function withCurrencySearchQuery(path: string, query: string): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams({ q: query });
  return `${path}?${params.toString()}`;
}

export function currencyEditHref(slug: string, query = ""): string {
  return withCurrencySearchQuery(
    `${CURRENCY_LIST_PATH}/${encodeURIComponent(slug)}/edit`,
    query
  );
}

export function currencyEditorTabs(
  slug: string,
  query = ""
): EditorTab[] {
  return [
    {
      label: "General",
      href: currencyEditHref(slug, query),
      active: true,
    },
  ];
}

export function currencyCanDelete(shopListingCount: number): boolean {
  return shopListingCount === 0;
}

export function describeCurrencyShopListings(count: number): string {
  return count === 1 ? "1 shop listing" : `${count} shop listings`;
}
