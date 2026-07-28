export type CatalogueQueryValue = string | string[] | undefined;

export function readCatalogueQueryValue(
  value: CatalogueQueryValue
): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const normalizedValue = firstValue?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

export function resolveCataloguePage(
  rawPage: CatalogueQueryValue,
  totalCount: number,
  pageSize: number
): {
  currentPage: number;
  pageCount: number;
  skip: number;
} {
  const parsedPage = Number.parseInt(
    readCatalogueQueryValue(rawPage) ?? "",
    10
  );
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageCount
  );

  return {
    currentPage,
    pageCount,
    skip: (currentPage - 1) * pageSize,
  };
}

export function cataloguePageHref(
  basePath: string,
  page: number,
  query: Record<string, string | undefined> = {}
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
