import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AppShell } from "@/components/layout/app-shell";
import { ContentImage } from "@/components/content/content-image";
import { DirectoryFilterPopover } from "@/components/content/directory-filter-popover";
import { DirectoryOverviewPanel } from "@/components/content/directory-overview-panel";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { DirectoryViewToggle } from "@/components/content/directory-view-toggle";
import {
  LiveMatchCount,
  LiveMatchCountProvider,
} from "@/components/content/live-match-count";
import { LiveResetLink } from "@/components/content/live-filter-reset";
import { EmptyState } from "@/components/ui/empty-state";
import {
  cataloguePageHref,
  readCatalogueQueryValue,
  readCatalogueQueryValues,
  resolveCataloguePage,
} from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";
import { ACQUISITION_TYPE_LABELS } from "@/lib/validation/acquisition-source";

export const dynamic = "force-dynamic";
const ITEM_PAGE_SIZE = 24;

type ItemsPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    category?: string | string[];
    q?: string | string[];
  }>;
};

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const {
    page: rawPage,
    category: rawCategory,
    q: rawQuery,
  } = await searchParams;
  const selectedSlugs = readCatalogueQueryValues(rawCategory);
  const searchQuery = readCatalogueQueryValue(rawQuery);

  const [categories, totalItemCount, totalCategoryCount, verifiedItemCount] =
    await Promise.all([
      prisma.category.findMany({
        where: { items: { some: {} } },
        select: { id: true, name: true, slug: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.item.count(),
      prisma.category.count({ where: { items: { some: {} } } }),
      prisma.item.count({ where: { verifiedAt: { not: null } } }),
    ]);

  const validSlugs = selectedSlugs.filter((slug) =>
    categories.some((category) => category.slug === slug),
  );
  // Stale/invalid category slugs canonicalize to the supported URL rather
  // than silently being dropped from a filtered result set.
  if (validSlugs.length !== selectedSlugs.length) {
    redirect(
      cataloguePageHref("/items", 1, { category: validSlugs, q: searchQuery }),
    );
  }

  // The Category filter stays a database filter; the search term does not.
  // Items matching the current Category selection are loaded in full and
  // filtered live in the browser, so `?q=` only seeds the field and the first
  // page index.
  const itemWhere =
    validSlugs.length > 0
      ? { category: { slug: { in: validSlugs } } }
      : undefined;

  const itemCount = await prisma.item.count({ where: itemWhere });
  const { currentPage } = resolveCataloguePage(
    rawPage,
    itemCount,
    ITEM_PAGE_SIZE,
  );
  const items = await prisma.item.findMany({
    where: itemWhere,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      image: true,
      category: { select: { name: true } },
      acquisitionSources: {
        take: 1,
        select: { type: true },
        orderBy: { createdAt: "asc" },
      },
      shopListings: { take: 1, select: { id: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const cards = items.map((item) => ({
    ...item,
    source: item.acquisitionSources[0]
      ? ACQUISITION_TYPE_LABELS[item.acquisitionSources[0].type]
      : item.shopListings.length > 0
        ? "Shop"
        : null,
  }));

  const hasActiveFilters = validSlugs.length > 0 || !!searchQuery;

  const entries = cards.map((item, index) => ({
    key: item.id,
    text: item.name,
    grid: (
        <Link
          key={item.id}
          href={`/items/${item.slug}`}
          className="item-catalogue-card cx-item-in"
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
        >
          <span className="item-catalogue-card-media">
            <ContentImage
              imagePath={item.image}
              alt={`Image of ${item.name}`}
              size="grid"
            />
          </span>
          <span className="item-catalogue-card-body">
            <h3 className="item-catalogue-card-title" title={item.name}>
              {item.name}
            </h3>
            <span className="item-catalogue-card-category">
              {item.category?.name ?? "Uncategorized"}
            </span>
          </span>
          {item.description ? (
            <span
              className="item-catalogue-card-description"
              title={item.description}
            >
              {item.description}
            </span>
          ) : null}
          {item.source ? (
            <span className="item-catalogue-card-source">{item.source}</span>
          ) : null}
        </Link>
    ),
    list: (
        <Link
          key={item.id}
          href={`/items/${item.slug}`}
          className="item-catalogue-list-row cx-item-in"
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
        >
          <ContentImage
            imagePath={item.image}
            alt={`Image of ${item.name}`}
            size="row"
          />
          <h3 className="item-catalogue-list-name" title={item.name}>
            {item.name}
          </h3>
          <span className="item-catalogue-list-category">
            {item.category?.name ?? "Uncategorized"}
          </span>
          <span className="item-catalogue-list-description">
            {item.description ?? ""}
          </span>
          <span className="item-catalogue-list-source">
            {item.source ?? ""}
          </span>
        </Link>
    ),
  }));

  const categoryFilter = (
    <DirectoryFilterPopover
      label="Categories"
      paramName="category"
      basePath="/items"
      options={categories}
      selectedSlugs={validSlugs}
      preserve={{ q: searchQuery }}
    />
  );

  const noMatchesState = (
    <div className="directory-empty-state">
      <p className="directory-empty-title">No items found</p>
      <p className="directory-empty-body">
        Try a different search term or reset your filters.
      </p>
      <LiveResetLink href="/items" className="directory-empty-reset" queryOnly={validSlugs.length === 0}>
        Reset filters
      </LiveResetLink>
    </div>
  );

  return (
    <AppShell catalogue scenic="catalogue" wide>
      <div className="directory-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="Items" />
        <h1 className="directory-title">Items</h1>

        <LiveMatchCountProvider>
          <div className="directory-body">
            <div className="directory-content">
              {entries.length > 0 ? (
                <DirectoryViewToggle
                  search={{
                    basePath: "/items",
                    placeholder: "Find an item by name...",
                    initialQuery: searchQuery ?? "",
                    preserve: { category: validSlugs },
                  }}
                  toolbarExtra={categoryFilter}
                  entries={entries}
                  gridShell={{ containerClassName: "item-catalogue-grid" }}
                  listShell={{ containerClassName: "item-catalogue-list" }}
                  pageSize={ITEM_PAGE_SIZE}
                  initialPage={currentPage}
                  paginationLabel="Items pagination"
                  emptyState={noMatchesState}
                />
              ) : (
                <>
                  <div className="directory-toolbar">
                    <div className="directory-toolbar-left">
                      <DirectorySearchField
                        basePath="/items"
                        placeholder="Find an item by name..."
                        defaultValue={searchQuery}
                        preserve={{ category: validSlugs }}
                      />
                      {categoryFilter}
                    </div>
                  </div>
                  {hasActiveFilters ? (
                    noMatchesState
                  ) : (
                    <EmptyState
                      title="No items yet"
                      description="Item data will be added during the data model and content milestones."
                    />
                  )}
                </>
              )}
            </div>

            <DirectoryOverviewPanel
              title="Items Overview"
              stats={[
                { label: "Total Items", value: totalItemCount },
                { label: "Categories", value: totalCategoryCount },
                { label: "Verified Entries", value: verifiedItemCount },
                {
                  label: "Matching Now",
                  value: <LiveMatchCount fallback={itemCount} />,
                },
              ]}
            />
          </div>
        </LiveMatchCountProvider>
      </div>
    </AppShell>
  );
}
