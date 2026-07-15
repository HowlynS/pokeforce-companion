import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { prisma } from "@/lib/db";
import {
  countSearchResults,
  emptySearchResults,
  normalizeSearchQuery,
  searchGameData,
  type SearchResultEntry,
} from "@/lib/search/global-search";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

// Group order is fixed and deterministic; each group links to its existing
// public detail route. The fallback description labels the resource type so
// records without a description (all seeded Items, every Recipe) still get
// a meaningful card line.
const RESULT_GROUPS = [
  { key: "items", heading: "Items", basePath: "/items", fallback: "Item" },
  {
    key: "recipes",
    heading: "Recipes",
    basePath: "/recipes",
    fallback: "Recipe",
  },
  {
    key: "professions",
    heading: "Professions",
    basePath: "/professions",
    fallback: "Profession",
  },
  {
    key: "categories",
    heading: "Categories",
    basePath: "/categories",
    fallback: "Category",
  },
] as const;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = normalizeSearchQuery(q);

  // A blank or whitespace-only query never touches the database.
  const results =
    query === "" ? emptySearchResults() : await searchGameData(prisma, query);
  const totalResults = countSearchResults(results);

  return (
    <AppShell>
      <PageHeader
        title="Search"
        description="Search items, recipes, professions, and categories by name or description."
      />

      {/* Plain GET form: the query lives in the URL, no client JavaScript. */}
      <form
        action="/search"
        method="get"
        role="search"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: designTokens.layout.sectionGap,
        }}
      >
        <label style={{ display: "grid", gap: "6px", flex: "1 1 260px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>
            Search query
          </span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="e.g. iron"
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.sm,
              background: designTokens.colors.surface,
              color: designTokens.colors.text,
              padding: "10px 12px",
              fontSize: "16px",
              fontFamily: "inherit",
              width: "100%",
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            border: "none",
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.accent,
            color: designTokens.colors.background,
            padding: "10px 16px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            alignSelf: "end",
          }}
        >
          Search
        </button>
      </form>

      {query === "" ? (
        <EmptyState
          title="Start searching"
          description="Type a word from an item, recipe, profession, or category — for example a material like iron — and press Search."
        />
      ) : totalResults === 0 ? (
        // React escapes the interpolated query, so it renders as plain text.
        <EmptyState
          title="No results"
          description={`Nothing matched "${query}". Check the spelling or try a shorter word.`}
        />
      ) : (
        RESULT_GROUPS.map((group) => {
          const entries: SearchResultEntry[] = results[group.key];

          if (entries.length === 0) {
            return null;
          }

          return (
            <section key={group.key}>
              <h2
                style={{
                  fontSize: "24px",
                  lineHeight: 1.2,
                  margin: "0 0 16px",
                }}
              >
                {group.heading} ({entries.length})
              </h2>

              <ContentGrid>
                {entries.map((entry) => (
                  // A relational match shows its one context line (for
                  // example "Ingredient: Iron Ore") in place of the plain
                  // description/type label.
                  <Card
                    key={entry.slug}
                    title={entry.name}
                    description={
                      entry.context ?? entry.description ?? group.fallback
                    }
                    href={`${group.basePath}/${entry.slug}`}
                  />
                ))}
              </ContentGrid>
            </section>
          );
        })
      )}
    </AppShell>
  );
}
