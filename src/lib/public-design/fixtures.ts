export const PUBLIC_DESIGN_FIXTURES = [
  {
    key: "home-populated",
    label: "Populated home",
    family: "landing",
    path: "/",
    states: ["real aggregate counts", "scenic home", "resource navigation"],
  },
  {
    key: "items-populated",
    label: "Populated Item catalogue",
    family: "catalogue",
    path: "/items",
    states: ["normal records", "no image", "long names", "sparse final row"],
  },
  {
    key: "items-sparse",
    label: "Sparse Item catalogue",
    family: "catalogue",
    path: "/items?category=design-review-category-sparse",
    states: [
      "one Item",
      "single-card width audit",
      "Category filter",
      "legacy auto-fit expansion",
    ],
  },
  {
    key: "item-dense",
    label: "Dense Item detail",
    family: "detail",
    path: "/items/design-review-item-dense",
    states: ["many acquisition sources", "recipe uses", "shop listings", "verified"],
  },
  {
    key: "item-no-image",
    label: "No-image Item detail",
    family: "detail",
    path: "/items/design-review-item-no-image-long-name",
    states: ["no image", "very long name", "unverified", "hide empty"],
  },
  {
    key: "recipes-dense",
    label: "Dense Recipe catalogue",
    family: "catalogue",
    path: "/recipes?profession=design-review-profession-dense",
    states: ["many ingredients", "long result", "pagination", "Profession filter"],
  },
  {
    key: "recipe-many-ingredients",
    label: "Recipe with many ingredients",
    family: "detail",
    path: "/recipes/design-review-recipe-many-ingredients",
    states: ["custom image", "quantity range", "required level", "EXP reward"],
  },
  {
    key: "recipe-inherited-image",
    label: "Inherited-image Recipe detail",
    family: "detail",
    path: "/recipes/design-review-recipe-inherited-image",
    states: ["one ingredient", "inherited result image", "zero EXP", "no required level"],
  },
  {
    key: "professions-populated",
    label: "Populated Profession catalogue",
    family: "catalogue",
    path: "/professions",
    states: ["zero recipes", "one recipe", "dense recipes", "long description"],
  },
  {
    key: "profession-dense",
    label: "Dense Profession detail",
    family: "detail",
    path: "/professions/design-review-profession-dense",
    states: ["three previews", "browse all", "rich description", "verified"],
  },
  {
    key: "profession-zero",
    label: "Zero-Recipe Profession detail",
    family: "detail",
    path: "/professions/design-review-profession-zero",
    states: ["zero Recipes", "no image", "empty optional description", "hide preview"],
  },
  {
    key: "classes-populated",
    label: "Populated Class catalogue",
    family: "catalogue",
    path: "/classes",
    states: ["sparse Class", "rich Class", "no image", "long label"],
  },
  {
    key: "class-rich",
    label: "Rich Class detail",
    family: "detail",
    path: "/classes/design-review-class-rich",
    states: ["rich description", "no image", "verified"],
  },
  {
    key: "class-sparse",
    label: "Sparse Class detail",
    family: "detail",
    path: "/classes/design-review-class-sparse",
    states: ["empty optional description", "no image", "unverified"],
  },
  {
    key: "categories-populated",
    label: "Populated Category catalogue",
    family: "catalogue",
    path: "/categories",
    states: ["sparse Category", "long label", "relationship count"],
  },
  {
    key: "category-rich",
    label: "Rich Category detail",
    family: "detail",
    path: "/categories/design-review-category-rich",
    states: ["rich description", "long name", "filtered Items link"],
  },
  {
    key: "category-sparse",
    label: "Sparse Category detail",
    family: "detail",
    path: "/categories/design-review-category-sparse",
    states: ["zero Items", "no image", "hide browse link"],
  },
  {
    key: "locations-populated",
    label: "Location type catalogue",
    family: "catalogue",
    path: "/locations",
    states: ["all Location types", "long names", "flat deterministic index"],
  },
  {
    key: "location-dense",
    label: "Dense Location detail",
    family: "detail",
    path: "/locations/design-review-location-dense",
    states: ["deep breadcrumb", "children", "Shops", "obtainable Items"],
  },
  {
    key: "shops-populated",
    label: "Populated Shop catalogue",
    family: "catalogue",
    path: "/shops",
    states: ["search", "no inventory", "many listings", "long names"],
  },
  {
    key: "shop-sparse",
    label: "Sparse Shop detail",
    family: "detail",
    path: "/shops/design-review-shop-sparse",
    states: ["no inventory", "no image", "unverified", "hide empty"],
  },
  {
    key: "shop-dense",
    label: "Dense Shop detail",
    family: "detail",
    path: "/shops/design-review-shop-dense",
    states: ["many listings", "multiple currencies", "rich description", "verified"],
  },
  {
    key: "shops-no-results",
    label: "Shop search with no results",
    family: "catalogue",
    path: "/shops?q=Design%20Review%20No%20Matches",
    states: ["no result", "query feedback", "clear action"],
  },
  {
    key: "search-results",
    label: "Grouped search results",
    family: "utility",
    path: "/search?q=Design%20Review",
    states: ["seven groups", "relationship context", "bounded results"],
  },
  {
    key: "search-empty",
    label: "Empty global search",
    family: "utility",
    path: "/search",
    states: ["blank query", "no database search", "guidance"],
  },
  {
    key: "search-no-results",
    label: "Global search with no results",
    family: "utility",
    path: "/search?q=Design%20Review%20No%20Matches",
    states: ["no result", "escaped query", "actionable guidance"],
  },
  {
    key: "not-found-item",
    label: "Public not found",
    family: "system",
    path: "/items/design-review-not-found",
    states: ["real 404", "shared public shell", "single H1"],
  },
] as const;

export type PublicDesignFixtureKey =
  (typeof PUBLIC_DESIGN_FIXTURES)[number]["key"];

export type PublicDesignFixture = (typeof PUBLIC_DESIGN_FIXTURES)[number];

export const PUBLIC_DESIGN_RECORD_MANIFEST = [
  { model: "Category", slug: "design-review-category-rich", states: ["rich description", "long label", "many Items"] },
  { model: "Category", slug: "design-review-category-sparse", states: ["empty optional description", "zero Items", "no image"] },
  { model: "Item", slug: "design-review-item-dense", states: ["verified", "tradeable", "held item Yes", "many acquisition types", "many Recipe usages", "many Shop listings", "rich text and links"] },
  { model: "Item", slug: "design-review-item-no-image-long-name", states: ["unverified", "non-tradeable", "held item No", "no image", "very long name", "no acquisition"] },
  { model: "Recipe", slug: "design-review-recipe-many-ingredients", states: ["more than four ingredients", "high quantities", "yield range", "custom image", "Profession level", "EXP reward"] },
  { model: "Recipe", slug: "design-review-recipe-inherited-image", states: ["one ingredient", "inherited result image", "single yield"] },
  { model: "Profession", slug: "design-review-profession-dense", states: ["more than one catalogue page", "three preview Recipes", "dense craft path", "long rich description"] },
  { model: "Profession", slug: "design-review-profession-zero", states: ["zero Recipes", "sparse", "no image"] },
  { model: "Profession", slug: "design-review-profession-one", states: ["one Recipe", "sparse craft path"] },
  { model: "PlayerClass", slug: "design-review-class-rich", states: ["rich description", "verified", "no image"] },
  { model: "PlayerClass", slug: "design-review-class-sparse", states: ["empty optional description", "unverified"] },
  { model: "Location", slug: "design-review-location-dense", states: ["deep breadcrumb", "many obtainable Items", "dense acquisition relations", "long authored description"] },
  { model: "Location", slug: "design-review-location-region", states: ["REGION", "parent hierarchy"] },
  { model: "Location", slug: "design-review-location-route", states: ["ROUTE", "parent/child hierarchy"] },
  { model: "Location", slug: "design-review-location-town", states: ["TOWN", "parent/child hierarchy"] },
  { model: "Location", slug: "design-review-location-building", states: ["BUILDING", "parent/child hierarchy"] },
  { model: "Location", slug: "design-review-location-dungeon", states: ["DUNGEON", "parent/child hierarchy"] },
  { model: "Location", slug: "design-review-location-sub-area", states: ["SUB_AREA", "parent/child hierarchy"] },
  { model: "Shop", slug: "design-review-shop-sparse", states: ["no inventory", "missing image", "unverified", "long location name"] },
  { model: "Shop", slug: "design-review-shop-dense", states: ["many listings", "multiple currencies", "verified", "long name"] },
  { model: "Currency", slug: "design-review-currency-gold", states: ["rich description", "image", "verified"] },
  { model: "Currency", slug: "design-review-currency-token", states: ["sparse", "no image", "unverified"] },
] as const;

export function getPublicDesignFixture(
  key: string
): PublicDesignFixture | undefined {
  return PUBLIC_DESIGN_FIXTURES.find((fixture) => fixture.key === key);
}
export const PUBLIC_DESIGN_SLUG_PREFIX = "design-review-";
export const PUBLIC_DESIGN_NAME_PREFIX = "Design Review - ";
export const PUBLIC_DESIGN_GAME_VERSION_NAME =
  "Design Review - Verified Gameplay";
export const PUBLIC_DESIGN_IMAGE_PATH =
  "items/test-service-public-design-fixture.png";
