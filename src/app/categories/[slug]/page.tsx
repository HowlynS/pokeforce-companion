import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 16px",
        fontSize: "24px",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
}

function buildItemCardDescription(item: {
  rarity: string | null;
  tradeable: boolean;
}): string {
  // Only meaningful metadata makes it onto the card: an unset rarity is
  // omitted rather than rendered as "Unknown".
  const details: string[] = [];

  if (item.rarity) {
    details.push(`Rarity: ${item.rarity}`);
  }

  details.push(`Tradeable: ${item.tradeable ? "Yes" : "No"}`);

  return details.join(" · ");
}

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!category) {
    notFound();
  }

  return (
    <AppShell>
      <PageHeader
        title={category.name}
        description={category.description ?? "No description available."}
      />

      <section>
        <SectionHeading>Items</SectionHeading>

        {category.items.length > 0 ? (
          <ContentGrid>
            {category.items.map((item) => (
              <Card
                key={item.id}
                title={item.name}
                description={buildItemCardDescription(item)}
                href={`/items/${item.slug}`}
              />
            ))}
          </ContentGrid>
        ) : (
          <EmptyState
            title="No items yet"
            description="No items are currently linked to this category."
          />
        )}
      </section>
    </AppShell>
  );
}
