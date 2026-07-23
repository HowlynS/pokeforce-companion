import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { prisma } from "@/lib/db";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

export const dynamic = "force-dynamic";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

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

      <section className="detail-hero">
        <ContentImage
          imagePath={category.image}
          alt={`Image of ${category.name}`}
          size="detail"
        />

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
          <SectionHeading icon={SECTION_ICONS.items}>Items</SectionHeading>

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
