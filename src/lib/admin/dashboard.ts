// Pure helpers for the /admin dashboard (Slice 9G.1): the canonical
// resource route mapping every summary card and quick-action link uses,
// plus small text-formatting helpers for counts and Game Version status.
// No React, no database — the dashboard page applies these to its own
// Prisma counts, and the unit tests pin them. This is an administrative
// summary, not an analytics dashboard: no percentages, no trends, no
// derived metrics live here.

export type DashboardResourceKey =
  | "items"
  | "recipes"
  | "professions"
  | "categories"
  | "locations";

export type DashboardResourceRoute = {
  key: DashboardResourceKey;
  label: string;
  listHref: string;
  createHref: string;
  createLabel: string;
};

/** The ONE canonical route mapping every dashboard resource summary card
    and quick-action link uses — exactly the five completed reference
    workspaces, in the same order as the admin sidebar. These are the
    same list/create routes each workspace's own navigation-foundation
    slice established; no aliases, no redirects. */
export const DASHBOARD_RESOURCE_ROUTES: readonly DashboardResourceRoute[] = [
  {
    key: "items",
    label: "Items",
    listHref: "/admin/items",
    createHref: "/admin/items/new",
    createLabel: "Create item",
  },
  {
    key: "recipes",
    label: "Recipes",
    listHref: "/admin/recipes",
    createHref: "/admin/recipes/new",
    createLabel: "Create recipe",
  },
  {
    key: "professions",
    label: "Professions",
    listHref: "/admin/professions",
    createHref: "/admin/professions/new",
    createLabel: "Create profession",
  },
  {
    key: "categories",
    label: "Categories",
    listHref: "/admin/categories",
    createHref: "/admin/categories/new",
    createLabel: "Create category",
  },
  {
    key: "locations",
    label: "Locations",
    listHref: "/admin/locations",
    createHref: "/admin/locations/new",
    createLabel: "Create location",
  },
] as const;

/**
 * Chooses the singular or plural form of a count's unit word — zero uses
 * the plural form, matching every existing record-list count label in
 * this codebase (e.g. "0 locations", "1 location", "3 locations"). Zero
 * is itself meaningful administrative context and is never hidden or
 * replaced by a placeholder.
 */
export function pluralize(
  count: number,
  singular: string,
  plural: string = `${singular}s`
): string {
  return count === 1 ? singular : plural;
}

/**
 * The Game Version panel's current-version status line: the version's
 * own human-readable name when one is configured, or a restrained
 * administrative status — never a placeholder dash, never a fabricated
 * version — when none is current. Deliberately takes only the `name`
 * field so a caller can never accidentally surface the version's
 * database id here.
 */
export function describeCurrentGameVersion(
  current: { name: string } | null
): string {
  return current ? current.name : "No current game version selected";
}
