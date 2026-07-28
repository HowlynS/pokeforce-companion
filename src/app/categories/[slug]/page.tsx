import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentImage } from "@/components/content/content-image";
import { RichTextContent } from "@/components/content/rich-text-content";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { cataloguePageHref } from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";
import { resolveRichTextValue } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CategoryDetailPage({
  params,
}: CategoryDetailPageProps) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      descriptionRich: true,
      image: true,
      _count: { select: { items: true } },
    },
  });

  if (!category) {
    notFound();
  }
  const description = resolveRichTextValue(
    category.descriptionRich,
    category.description
  );

  return (
    <AppShell>
      <PageHeader
        title={category.name}
        descriptionContent={description ? (
          <RichTextContent value={description} />
        ) : undefined}
      />

      <section className="detail-hero category-detail-summary">
        <ContentImage
          imagePath={category.image}
          alt={`Image of ${category.name}`}
          size="detail"
        />

        <div className="detail-hero-facts">
          <Card
            title="Details"
            description={`Items: ${category._count.items}`}
          />
          {category._count.items > 0 ? (
            <Link
              className="category-browse-link"
              href={cataloguePageHref("/items", 1, { category: slug })}
            >
              Browse {category.name} items
            </Link>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
