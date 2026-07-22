// Shared Recipe output-quantity formatting (Recipe output quantity range
// slice): one deterministic place to turn a persisted
// resultQuantityMin/resultQuantityMax pair into display text, reused by
// every public page and admin relationship display that shows a Recipe's
// output — never duplicated per call site.
//
// `formatRecipeQuantityRange` returns ONLY the quantity portion ("1",
// "1-4") — the bare form every admin table/relationship cell needs (they
// already carry their own surrounding label, e.g. a "Quantity" column
// heading, so prefixing "Produces" there would be redundant). `Produces`
// prose is layered on top by `formatRecipeProduces`, which every public
// page composes from the same bare range so the two can never disagree.
// An en dash (not a hyphen) separates a genuine range; a fixed output
// (min === max) never shows a redundant "1-1" — just the single number.
function formatRecipeQuantityRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function formatRecipeProduces(min: number, max: number): string {
  return `Produces ${formatRecipeQuantityRange(min, max)}`;
}

export { formatRecipeProduces, formatRecipeQuantityRange };
