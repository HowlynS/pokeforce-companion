import {
  PUBLIC_DESIGN_FIXTURES,
  getPublicDesignFixture,
  type PublicDesignFixture,
  type PublicDesignFixtureKey,
} from "@/lib/public-design/fixtures";
import {
  PUBLIC_DESIGN_VIEWPORTS,
  type PublicDesignViewportId,
} from "@/lib/public-design/viewports";

export const PUBLIC_PAGE_FAMILIES = [
  "landing",
  "catalogue",
  "detail",
  "utility",
  "system",
] as const;

export type PublicPageFamily = (typeof PUBLIC_PAGE_FAMILIES)[number];
export type PublicScenicVariant = "home" | "catalogue" | "detail" | "none";

export type PublicDesignContract = {
  id: string;
  label: string;
  routePattern: string;
  pageFamily: PublicPageFamily;
  representativeFixture: PublicDesignFixtureKey;
  fixtures?: readonly PublicDesignFixtureKey[];
  scenicVariant: PublicScenicVariant;
  viewports: readonly PublicDesignViewportId[];
  requiredRegions: readonly string[];
  optionalRegions: readonly string[];
  interactions: readonly string[];
  imageRequirement: string;
  richTextRequirement: string;
  accessibility: readonly string[];
  focusedTests: readonly string[];
  knownCaveats: readonly string[];
};

const allPrimaryViewports = [
  "desktop-1920",
  "desktop-2560",
  "ultrawide-3440",
  "intermediate-1000",
  "mobile-390",
] as const satisfies readonly PublicDesignViewportId[];

const shellRegions = ["header", "primary navigation", "site search", "main", "footer"];
const shellA11y = ["one H1", "visible focus", "labelled navigation", "no horizontal overflow"];

export const PUBLIC_DESIGN_CONTRACTS = [
  {
    id: "home",
    label: "Homepage",
    routePattern: "/",
    pageFamily: "landing",
    representativeFixture: "home-populated",
    scenicVariant: "home",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "hero", "statistics", "resource links"],
    optionalRegions: [],
    interactions: ["browse Items", "explore Recipes", "open resource family"],
    imageRequirement: "Appearance home scenic background with committed fallback",
    richTextRequirement: "No authored rich text",
    accessibility: [...shellA11y, "statistics use a description list"],
    focusedTests: ["e2e/public-landing.spec.ts", "src/components/layout/app-shell.test.tsx"],
    knownCaveats: ["Statistics depend on four live aggregate queries"],
  },
  {
    id: "items-index",
    label: "Items catalogue",
    routePattern: "/items",
    pageFamily: "catalogue",
    representativeFixture: "items-populated",
    scenicVariant: "catalogue",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "Category filter", "Item grid"],
    optionalRegions: ["pagination"],
    interactions: ["change Category filter", "open Item", "change page"],
    imageRequirement: "Square card stages; genuine sprites and no-image fallbacks share geometry",
    richTextRequirement: "Descriptions do not render in Item cards",
    accessibility: [...shellA11y, "active filter uses aria-current", "pagination is labelled"],
    focusedTests: ["e2e/public-recipe-catalogues.spec.ts", "src/components/content/content-image.test.tsx"],
    knownCaveats: ["Invalid Category redirects to the unfiltered canonical route"],
  },
  {
    id: "item-detail",
    label: "Item detail",
    routePattern: "/items/[slug]",
    pageFamily: "detail",
    representativeFixture: "item-dense",
    fixtures: ["item-dense", "item-no-image"],
    scenicVariant: "detail",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "breadcrumb", "Item identity", "Held item", "Item details", "Verification"],
    optionalRegions: ["description", "Category", "How to obtain", "Used in recipes", "Last updated"],
    interactions: ["follow breadcrumb", "open Shop/Location/Profession", "open Recipe"],
    imageRequirement: "Hero ContentImage preserves aspect ratio and fallback geometry",
    richTextRequirement: "Safe semantic authored description; hidden when empty",
    accessibility: [...shellA11y, "breadcrumb ordered list", "linked rows have meaningful names"],
    focusedTests: ["e2e/public-details.spec.ts", "src/components/content/rich-text-content.test.tsx"],
    knownCaveats: ["Tradeable and base value are schema facts but intentionally not public"],
  },
  {
    id: "recipes-index",
    label: "Recipes catalogue",
    routePattern: "/recipes",
    pageFamily: "catalogue",
    representativeFixture: "recipes-dense",
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "Profession filter", "Recipe grid"],
    optionalRegions: ["pagination", "ingredient disclosure"],
    interactions: ["change Profession filter", "open Recipe/result/ingredient", "reveal extra ingredients", "change page"],
    imageRequirement: "Custom Recipe image or inherited result image; fixed output/fallback stage",
    richTextRequirement: "No authored rich text in cards",
    accessibility: [...shellA11y, "focused ingredient tooltip remains visible", "Profession-only filter"],
    focusedTests: ["e2e/public-recipe-catalogues.spec.ts", "src/components/content/recipe-output-card.test.tsx"],
    knownCaveats: ["Stale Class query is redirected away"],
  },
  {
    id: "recipe-detail",
    label: "Recipe detail",
    routePattern: "/recipes/[slug]",
    pageFamily: "detail",
    representativeFixture: "recipe-many-ingredients",
    fixtures: ["recipe-many-ingredients", "recipe-inherited-image"],
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "breadcrumb", "Recipe identity", "Crafted result", "Recipe details", "Verification"],
    optionalRegions: ["Profession", "required level", "Ingredients", "Last updated"],
    interactions: ["open ingredient Item", "open result Item", "open Profession"],
    imageRequirement: "Hero inherits result image when custom image is absent; one intentional result image repeat",
    richTextRequirement: "Recipe has no description field",
    accessibility: [...shellA11y, "ingredient and result rows are single semantic links"],
    focusedTests: ["e2e/public-recipe-details.spec.ts", "src/lib/recipes/recipe-image.test.ts"],
    knownCaveats: ["Hero and crafted-result image are the two approved image occurrences"],
  },
  {
    id: "professions-index",
    label: "Professions catalogue",
    routePattern: "/professions",
    pageFamily: "catalogue",
    representativeFixture: "professions-populated",
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "Profession grid"],
    optionalRegions: [],
    interactions: ["open Profession"],
    imageRequirement: "Card ContentImage or fallback",
    richTextRequirement: "Plain compatibility description only in catalogue cards",
    accessibility: shellA11y,
    focusedTests: ["e2e/public-navigation.spec.ts"],
    knownCaveats: ["Current index query loads all Recipe names to build card copy"],
  },
  {
    id: "profession-detail",
    label: "Profession detail",
    routePattern: "/professions/[slug]",
    pageFamily: "detail",
    representativeFixture: "profession-dense",
    fixtures: ["profession-dense", "profession-zero"],
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "breadcrumb", "Profession identity", "Recipe/result counts", "Verification"],
    optionalRegions: ["description", "Recipe preview", "Last updated"],
    interactions: ["open preview Recipe", "browse all filtered Recipes"],
    imageRequirement: "Neutral hero ContentImage/fallback without resource atmosphere",
    richTextRequirement: "Safe semantic authored description; hidden when empty",
    accessibility: [...shellA11y, "preview links expose result/yield context"],
    focusedTests: ["e2e/public-profession-details.spec.ts"],
    knownCaveats: ["Only the first three deterministic Recipes are previewed"],
  },
  {
    id: "classes-index",
    label: "Classes catalogue",
    routePattern: "/classes",
    pageFamily: "catalogue",
    representativeFixture: "classes-populated",
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "Class grid"],
    optionalRegions: [],
    interactions: ["open Class"],
    imageRequirement: "Card ContentImage/fallback",
    richTextRequirement: "Plain compatibility description only in catalogue cards",
    accessibility: shellA11y,
    focusedTests: ["e2e/public-classes.spec.ts"],
    knownCaveats: ["PlayerClass is independent from Recipes"],
  },
  {
    id: "class-detail",
    label: "Class detail",
    routePattern: "/classes/[slug]",
    pageFamily: "detail",
    representativeFixture: "class-rich",
    fixtures: ["class-rich", "class-sparse"],
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "breadcrumb", "Class identity", "Verification"],
    optionalRegions: ["description", "Last updated"],
    interactions: ["follow breadcrumb"],
    imageRequirement: "Neutral hero ContentImage/fallback",
    richTextRequirement: "Safe semantic authored description; hidden when empty",
    accessibility: shellA11y,
    focusedTests: ["e2e/public-classes.spec.ts"],
    knownCaveats: ["No Recipe counts, previews, or links are allowed"],
  },
  {
    id: "categories-index",
    label: "Categories catalogue",
    routePattern: "/categories",
    pageFamily: "catalogue",
    representativeFixture: "categories-populated",
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "Category grid"],
    optionalRegions: [],
    interactions: ["open Category"],
    imageRequirement: "Card ContentImage/fallback",
    richTextRequirement: "Plain compatibility description only in catalogue cards",
    accessibility: shellA11y,
    focusedTests: ["e2e/public-recipe-catalogues.spec.ts"],
    knownCaveats: ["Current index query loads all Item names to build card copy"],
  },
  {
    id: "category-detail",
    label: "Category detail",
    routePattern: "/categories/[slug]",
    pageFamily: "detail",
    representativeFixture: "category-rich",
    fixtures: ["category-rich", "category-sparse"],
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "Category image", "Item count"],
    optionalRegions: ["description", "browse filtered Items"],
    interactions: ["browse filtered Items"],
    imageRequirement: "Detail ContentImage/fallback",
    richTextRequirement: "Safe semantic authored description; hidden when empty",
    accessibility: shellA11y,
    focusedTests: ["e2e/public-recipe-catalogues.spec.ts"],
    knownCaveats: ["Category detail deliberately does not duplicate an Item grid"],
  },
  {
    id: "locations-index",
    label: "Locations catalogue",
    routePattern: "/locations",
    pageFamily: "catalogue",
    representativeFixture: "locations-populated",
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "flat Location grid"],
    optionalRegions: [],
    interactions: ["open Location"],
    imageRequirement: "No image rendered in Location index cards",
    richTextRequirement: "No description rendered in Location index cards",
    accessibility: shellA11y,
    focusedTests: ["e2e/public-navigation.spec.ts"],
    knownCaveats: ["Hierarchy appears only on detail pages"],
  },
  {
    id: "location-detail",
    label: "Location detail",
    routePattern: "/locations/[slug]",
    pageFamily: "detail",
    representativeFixture: "location-dense",
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "hierarchy breadcrumb", "Location identity"],
    optionalRegions: ["description", "Access", "Sub-locations", "Shops", "Obtainable Items"],
    interactions: ["open ancestor/child Location", "open Shop", "open Item"],
    imageRequirement: "Detail ContentImage/fallback",
    richTextRequirement: "Safe semantic authored description; hidden when empty",
    accessibility: [...shellA11y, "deep breadcrumb wraps and retains order"],
    focusedTests: ["e2e/public-details.spec.ts", "e2e/public-shops.spec.ts"],
    knownCaveats: ["Verification is intentionally admin-only on Location pages"],
  },
  {
    id: "shops-index",
    label: "Shops catalogue",
    routePattern: "/shops",
    pageFamily: "catalogue",
    representativeFixture: "shops-populated",
    fixtures: ["shops-populated", "shops-no-results"],
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "page heading", "Shop search", "Shop grid"],
    optionalRegions: ["result summary", "Clear search"],
    interactions: ["search Shops", "clear query", "open Shop"],
    imageRequirement: "Card ContentImage/fallback",
    richTextRequirement: "Plain compatibility description only in catalogue cards",
    accessibility: [...shellA11y, "route-local search has a distinct accessible name"],
    focusedTests: ["e2e/public-shops.spec.ts"],
    knownCaveats: ["Search results are unpaginated"],
  },
  {
    id: "shop-detail",
    label: "Shop detail",
    routePattern: "/shops/[slug]",
    pageFamily: "detail",
    representativeFixture: "shop-sparse",
    fixtures: ["shop-sparse", "shop-dense"],
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "hierarchy breadcrumb", "Shop identity", "Location"],
    optionalRegions: ["description", "Verification", "Inventory", "listing notes"],
    interactions: ["open Location", "open listed Item"],
    imageRequirement: "Detail and listing ContentImage/fallbacks preserve geometry",
    richTextRequirement: "Safe semantic authored description; hidden when empty",
    accessibility: [...shellA11y, "inventory is a semantic list of linked content"],
    focusedTests: ["e2e/public-shops.spec.ts"],
    knownCaveats: ["Page metadata shares a cached query with page rendering"],
  },
  {
    id: "search",
    label: "Global search",
    routePattern: "/search?q=[query]",
    pageFamily: "utility",
    representativeFixture: "search-results",
    fixtures: ["search-results", "search-empty", "search-no-results"],
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "search form", "result summary"],
    optionalRegions: ["resource result groups"],
    interactions: ["submit query", "open result"],
    imageRequirement: "Search result cards currently render no images",
    richTextRequirement: "Plain description projections only",
    accessibility: [...shellA11y, "header and page search landmarks have distinct names"],
    focusedTests: ["e2e/search.spec.ts", "src/lib/search/global-search.test.ts"],
    knownCaveats: ["Each resource group is capped at ten displayed results"],
  },
  {
    id: "not-found",
    label: "Public not found",
    routePattern: "/items/[missing-slug]",
    pageFamily: "system",
    representativeFixture: "not-found-item",
    scenicVariant: "none",
    viewports: allPrimaryViewports,
    requiredRegions: [...shellRegions, "not-found heading", "not-found guidance"],
    optionalRegions: [],
    interactions: ["use shared public navigation"],
    imageRequirement: "No content image",
    richTextRequirement: "No authored rich text",
    accessibility: shellA11y,
    focusedTests: ["e2e/public-shops.spec.ts"],
    knownCaveats: ["No application-owned loading or error boundary exists"],
  },
] as const satisfies readonly PublicDesignContract[];

export type PublicDesignContractId =
  (typeof PUBLIC_DESIGN_CONTRACTS)[number]["id"];

export function getPublicDesignContract(
  id: string
): (typeof PUBLIC_DESIGN_CONTRACTS)[number] | undefined {
  return PUBLIC_DESIGN_CONTRACTS.find((contract) => contract.id === id);
}

export function getPublicDesignContractFixtures(
  contract: PublicDesignContract
): readonly PublicDesignFixtureKey[] {
  return contract.fixtures ?? [contract.representativeFixture];
}

export function resolvePublicDesignRoute(
  contract: PublicDesignContract,
  fixture: PublicDesignFixture
): string {
  if (!getPublicDesignContractFixtures(contract).includes(fixture.key)) {
    throw new Error(
      `Fixture ${fixture.key} is not registered for contract ${contract.id}.`
    );
  }
  return fixture.path;
}

export function validatePublicDesignContracts(): string[] {
  const errors: string[] = [];
  const contractIds = new Set<string>();
  const fixtureKeys = new Set(PUBLIC_DESIGN_FIXTURES.map(({ key }) => key));
  const viewportIds = new Set(PUBLIC_DESIGN_VIEWPORTS.map(({ id }) => id));
  const families = new Set<string>(PUBLIC_PAGE_FAMILIES);

  for (const contract of PUBLIC_DESIGN_CONTRACTS as readonly PublicDesignContract[]) {
    if (contractIds.has(contract.id)) errors.push(`Duplicate contract ID: ${contract.id}`);
    contractIds.add(contract.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(contract.id)) errors.push(`Invalid contract ID: ${contract.id}`);
    if (!contract.label.trim() || !contract.routePattern.startsWith("/")) errors.push(`Missing contract metadata: ${contract.id}`);
    if (!families.has(contract.pageFamily)) errors.push(`Unsupported page family: ${contract.id}`);
    if (!fixtureKeys.has(contract.representativeFixture)) errors.push(`Unknown fixture: ${contract.id}`);
    const contractFixtures = getPublicDesignContractFixtures(contract);
    if (!contractFixtures.includes(contract.representativeFixture)) errors.push(`Representative fixture is not selectable: ${contract.id}`);
    if (new Set(contractFixtures).size !== contractFixtures.length || contractFixtures.some((key) => !fixtureKeys.has(key))) errors.push(`Invalid fixture options: ${contract.id}`);
    if (contract.viewports.length === 0 || contract.viewports.some((id) => !viewportIds.has(id))) errors.push(`Invalid viewports: ${contract.id}`);
    if (contract.requiredRegions.length === 0 || contract.accessibility.length === 0 || contract.focusedTests.length === 0) errors.push(`Incomplete contract metadata: ${contract.id}`);

    const fixture = getPublicDesignFixture(contract.representativeFixture);
    if (fixture) {
      try {
        const route = resolvePublicDesignRoute(contract, fixture);
        if (!route.startsWith("/") || route.startsWith("//") || route.startsWith("/admin")) errors.push(`Unsafe route: ${contract.id}`);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Invalid route: ${contract.id}`);
      }
    }
  }
  return errors;
}

export function assertValidPublicDesignContracts(): void {
  const errors = validatePublicDesignContracts();
  if (errors.length > 0) throw new Error(`Invalid public design registry:\n${errors.join("\n")}`);
}
