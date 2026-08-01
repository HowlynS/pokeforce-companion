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
    key: "item-dense",
    label: "Dense Item detail",
    family: "detail",
    path: "/items/design-review-item-dense",
    states: ["many acquisition sources", "recipe uses", "shop listings", "verified"],
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
    key: "search-results",
    label: "Grouped search results",
    family: "utility",
    path: "/search?q=Design%20Review",
    states: ["seven groups", "relationship context", "bounded results"],
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

export function getPublicDesignFixture(
  key: string
): PublicDesignFixture | undefined {
  return PUBLIC_DESIGN_FIXTURES.find((fixture) => fixture.key === key);
}
