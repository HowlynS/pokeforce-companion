import { redirect } from "next/navigation";
import { CataloguePagination } from "@/components/content/catalogue-pagination";
import { ContentImage } from "@/components/content/content-image";
import { PublicFilterNav } from "@/components/content/public-filter-nav";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import {
  cataloguePageHref,
  readCatalogueQueryValue,
  resolveCataloguePage,
} from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
const ITEM_PAGE_SIZE = 12;

type ItemsPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    category?: string | string[];
  }>;
};

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const { page: rawPage, category: rawCategory } = await searchParams;
  const categorySlug = readCatalogueQueryValue(rawCategory);
  const categories = await prisma.category.findMany({
    where: { items: { some: {} } },
    select: { id: true, name: true, slug: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const selectedCategory = categorySlug
    ? categories.find((category) => category.slug === categorySlug)
    : undefined;

  if (categorySlug && !selectedCategory) {
    redirect("/items");
  }

  const itemWhere = selectedCategory
    ? { category: { slug: selectedCategory.slug } }
    : undefined;
  const itemCount = await prisma.item.count({ where: itemWhere });
  const { currentPage, pageCount, skip } = resolveCataloguePage(
    rawPage,
    itemCount,
    ITEM_PAGE_SIZE
  );
  const items = await prisma.item.findMany({
    where: itemWhere,
    include: { category: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip,
    take: ITEM_PAGE_SIZE,
  });

  return (
    <AppShell scenic="catalogue">
      <PageHeader
        title="Items"
        description="Browse items, materials, and useful crafting resources."
      />

      <PublicFilterNav
        label="Filter Items by Category"
        options={[
          { label: "All", href: "/items", active: !selectedCategory },
          ...categories.map((category) => ({
            label: category.name,
            href: cataloguePageHref("/items", 1, {
              category: category.slug,
            }),
            active: category.slug === selectedCategory?.slug,
          })),
        ]}
      />

      {itemCount > 0 ? (
        <section className="item-index-catalogue" aria-label="Item catalogue">
          <ContentGrid>
            {items.map((item) => (
              <Card
                key={item.id}
                title={item.name}
                description={
                  <span className="item-index-card-category">
                    {item.category?.name ?? "Uncategorized"}
                  </span>
                }
                href={`/items/${item.slug}`}
                media={
                  <div className="item-index-card-media">
                    <ContentImage
                      imagePath={item.image}
                      alt={`Image of ${item.name}`}
                      size="card"
                    />
                  </div>
                }
              />
            ))}
          </ContentGrid>
          <CataloguePagination
            basePath="/items"
            currentPage={currentPage}
            pageCount={pageCount}
            label="Items pagination"
            query={{ category: selectedCategory?.slug }}
          />
        </section>
      ) : (
        <EmptyState
          title="No items yet"
          description="Item data will be added during the data model and content milestones."
        />
      )}
    </AppShell>
  );
}
