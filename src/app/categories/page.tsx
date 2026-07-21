import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildCategoryDescription(category: {
  description: string | null;
  items: { name: string }[];
}): string {
  const itemList =
    category.items.length > 0
      ? category.items.map((item) => item.name).join(", ")
      : "No items yet";

  const detailLine = `Items (${category.items.length}): ${itemList}`;

  return category.description ? `${category.description} · ${detailLine}` : detailLine;
}

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    include: {
      items: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Categories"
        description="Navigate item and recipe categories for faster browsing."
      />

      {categories.length > 0 ? (
        <ContentGrid>
          {categories.map((category) => (
            <Card
              key={category.id}
              title={category.name}
              description={buildCategoryDescription(category)}
              href={`/categories/${category.slug}`}
              media={
                <ContentImage
                  imagePath={category.image}
                  alt={`Image of ${category.name}`}
                  size="card"
                />
              }
            />
          ))}
        </ContentGrid>
      ) : (
        <EmptyState
          title="No categories yet"
          description="Categories will be added once the core content structure is ready."
        />
      )}
    </AppShell>
  );
}
