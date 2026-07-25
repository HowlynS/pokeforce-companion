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
