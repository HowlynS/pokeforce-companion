export type ShopListingInput = {
  itemId: string;
  currencyId: string;
  priceAmount: number;
  notes: string | null;
};

export type ShopListingValidationError =
  | "missing_item"
  | "missing_currency"
  | "invalid_price";

export type ShopListingParseResult =
  | { ok: true; value: ShopListingInput }
  | { ok: false; error: ShopListingValidationError };

export const MAX_SUBMITTED_SHOP_INVENTORY_ROWS = 100;

export type SubmittedShopInventoryRow = ShopListingInput & {
  key: string;
  listingId: string | null;
};

export type ShopInventoryValidationError =
  | ShopListingValidationError
  | "duplicate_listing"
  | "invalid_inventory";

export type ShopInventoryParseResult =
  | {
      ok: true;
      value: { rowKeys: string[]; rows: SubmittedShopInventoryRow[] };
    }
  | { ok: false; error: ShopInventoryValidationError };

export function parseShopListingInput(
  formData: FormData,
  fieldPrefix = ""
): ShopListingParseResult {
  const itemId = String(formData.get(`${fieldPrefix}itemId`) ?? "").trim();
  const currencyId = String(
    formData.get(`${fieldPrefix}currencyId`) ?? ""
  ).trim();
  const rawPrice = String(
    formData.get(`${fieldPrefix}priceAmount`) ?? ""
  ).trim();
  const notes = String(formData.get(`${fieldPrefix}notes`) ?? "").trim();

  if (!itemId) {
    return { ok: false, error: "missing_item" };
  }

  if (!currencyId) {
    return { ok: false, error: "missing_currency" };
  }

  const priceAmount = Number(rawPrice);

  if (
    !rawPrice ||
    !Number.isInteger(priceAmount) ||
    !Number.isFinite(priceAmount) ||
    priceAmount <= 0 ||
    priceAmount > 2_147_483_647
  ) {
    return { ok: false, error: "invalid_price" };
  }

  return {
    ok: true,
    value: {
      itemId,
      currencyId,
      priceAmount,
      notes: notes || null,
    },
  };
}

export function shopListingCombinationKey(listing: {
  itemId: string;
  currencyId: string;
}): string {
  return `${listing.itemId}\u0000${listing.currencyId}`;
}

export function hasDuplicateShopListingCombinations(
  listings: readonly { itemId: string; currencyId: string }[]
): boolean {
  const keys = listings.map(shopListingCombinationKey);
  return new Set(keys).size !== keys.length;
}

const SAFE_ROW_KEY = /^(existing|new)-[a-zA-Z0-9_-]+$/;

/**
 * Parses the dynamic Inventory form without trusting its client-supplied row
 * keys. Inactive rows are staged removals (or unused blank slots) and are
 * intentionally omitted from the returned replacement set.
 */
export function parseShopInventoryInput(
  formData: FormData
): ShopInventoryParseResult {
  const rowKeys = formData
    .getAll("listingRowKey")
    .map((value) => String(value).trim());

  if (
    rowKeys.length > MAX_SUBMITTED_SHOP_INVENTORY_ROWS ||
    new Set(rowKeys).size !== rowKeys.length ||
    rowKeys.some((key) => !SAFE_ROW_KEY.test(key))
  ) {
    return { ok: false, error: "invalid_inventory" };
  }

  const rows: SubmittedShopInventoryRow[] = [];
  for (const key of rowKeys) {
    if (formData.get(`${key}.active`) !== "1") {
      continue;
    }

    const parsed = parseShopListingInput(formData, `${key}.`);
    if (!parsed.ok) {
      return parsed;
    }

    const listingId =
      String(formData.get(`${key}.listingId`) ?? "").trim() || null;
    rows.push({ key, listingId, ...parsed.value });
  }

  if (hasDuplicateShopListingCombinations(rows)) {
    return { ok: false, error: "duplicate_listing" };
  }

  return { ok: true, value: { rowKeys, rows } };
}
