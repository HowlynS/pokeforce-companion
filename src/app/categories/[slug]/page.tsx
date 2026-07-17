import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
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

function buildItemCardDescription(item: { tradeable: boolean }): string {
  return `Tradeable: ${item.tradeable ? "Yes" : "No"}`;
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
        description={category.description ?? undefined}
      />

      {/* Categories store no image, so the hero holds only the facts card. */}
      <section className="detail-hero">
        <div className="detail-hero-facts">
          <Card
            title="Details"
            description={`Items: ${category.items.length}`}
          />
        </div>
      </section>

      {/* Omitted entirely (heading included) when the category holds no
          items — public detail pages never render empty optional sections.
          The Details card above still states "Items: 0". */}
      {category.items.length > 0 ? (
        <section>
          <SectionHeading>Items</SectionHeading>

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
        </section>
      ) : null}
    </AppShell>
  );
}
