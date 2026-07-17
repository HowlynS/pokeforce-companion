import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildItemDescription(item: {
  description: string | null;
  category: { name: string } | null;
  tradeable: boolean;
  baseValue: number | null;
}): string {
  // Only meaningful metadata makes it onto the card: unset optional fields
  // are omitted rather than rendered as placeholder values.
  const details: string[] = [];

  if (item.category) {
    details.push(`Category: ${item.category.name}`);
  }

  details.push(`Tradeable: ${item.tradeable ? "Yes" : "No"}`);

  if (item.baseValue !== null) {
    details.push(`Base value: ${item.baseValue}`);
  }

  const detailLine = details.join(" · ");

  return item.description ? `${item.description} (${detailLine})` : detailLine;
}

export default async function ItemsPage() {
  const items = await prisma.item.findMany({
    include: { category: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        title="Items"
        description="Browse items, materials, and useful crafting resources."
      />

      {items.length > 0 ? (
        <ContentGrid>
          {items.map((item) => (
            <Card
              key={item.id}
              title={item.name}
              description={buildItemDescription(item)}
              href={`/items/${item.slug}`}
              media={
                <ContentImage
                  imagePath={item.image}
                  alt={`Image of ${item.name}`}
                  size="card"
                />
              }
            />
          ))}
        </ContentGrid>
      ) : (
        <EmptyState
          title="No items yet"
          description="Item data will be added during the data model and content milestones."
        />
      )}
    </AppShell>
  );
}
