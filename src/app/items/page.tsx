import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildItemDescription(item: {
  description: string | null;
  category: { name: string } | null;
  rarity: string | null;
  tradeable: boolean;
  baseValue: number | null;
}): string {
  const details = [
    `Category: ${item.category?.name ?? "Uncategorized"}`,
    `Rarity: ${item.rarity ?? "Unknown"}`,
    `Tradeable: ${item.tradeable ? "Yes" : "No"}`,
  ];

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
