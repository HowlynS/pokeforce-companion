import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { designTokens } from "@/lib/design-tokens";
import { prisma } from "@/lib/db";
import {
  buildAcquisitionSourceCard,
  groupAcquisitionSourcesByType,
} from "@/lib/validation/acquisition-source";

export const dynamic = "force-dynamic";

type ItemDetailPageProps = {
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

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { slug } = await params;

  const item = await prisma.item.findUnique({
    where: { slug },
    include: {
      category: true,
      recipesProduced: {
        orderBy: { name: "asc" },
      },
      recipeIngredients: {
        include: { recipe: true },
        orderBy: { recipe: { name: "asc" } },
      },
      acquisitionSources: {
        include: { location: true, profession: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!item) {
    notFound();
  }

  // Grouped by type (enum order), any type with zero sources omitted
  // entirely — the whole section below is skipped when there are none at
  // all. Neither the grouping nor its order implies priority or
  // completeness; it is simply a stable way to present more than one
  // source without repeating the type on every card.
  const acquisitionGroups = groupAcquisitionSourcesByType(item.acquisitionSources);

  // Only meaningful metadata is shown: unset optional fields are omitted
  // rather than rendered as placeholder values. The two booleans are
  // required fields, so Yes/No is always a real answer.
  const details: string[] = [];

  if (item.category) {
    details.push(`Category: ${item.category.name}`);
  }

  details.push(`Tradeable: ${item.tradeable ? "Yes" : "No"}`);
  details.push(`Held item: ${item.heldItem ? "Yes" : "No"}`);

  if (item.baseValue !== null) {
    details.push(`Base value: ${item.baseValue}`);
  }

  return (
    <AppShell>
      <PageHeader
        title={item.name}
        description={item.description ?? undefined}
      />

      <section className="detail-hero">
        <ContentImage
          imagePath={item.image}
          alt={`Image of ${item.name}`}
          size="detail"
        />

        <div className="detail-hero-facts">
          <Card title="Details" description={details.join(" · ")} />

          {/* Verification metadata is deliberately NOT rendered here:
              since Slice 9A, Game Version and verification information is
              admin-only and never appears on public pages. */}
        </div>
      </section>

      {/* Omitted entirely (heading included) when there are no acquisition
          sources — never a public empty state. Grouped by type so more
          than one source never repeats the type on every card; the
          heading makes no claim that the list is complete. */}
      {acquisitionGroups.length > 0 ? (
        <section style={{ marginBottom: designTokens.layout.sectionGap }}>
          <SectionHeading>How to obtain</SectionHeading>

          {acquisitionGroups.map((group) => (
            <div key={group.type} style={{ marginBottom: "16px" }}>
              <p
                style={{
                  margin: "0 0 8px",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                {group.label}
              </p>

              <ContentGrid>
                {group.sources.map((source) => {
                  const card = buildAcquisitionSourceCard(source);
                  return (
                    <Card
                      key={source.id}
                      title={card.title}
                      description={card.description}
                      href={card.href}
                    />
                  );
                })}
              </ContentGrid>
            </div>
          ))}
        </section>
      ) : null}

      {/* Omitted entirely (heading included) when no recipe produces this
          item — public detail pages never render empty optional sections. */}
      {item.recipesProduced.length > 0 ? (
        <section style={{ marginBottom: designTokens.layout.sectionGap }}>
          <SectionHeading>Produced by</SectionHeading>

          <ContentGrid>
            {item.recipesProduced.map((recipe) => (
              <Card
                key={recipe.id}
                title={recipe.name}
                description={`Yields ${recipe.resultingQuantity}x per craft.`}
                href={`/recipes/${recipe.slug}`}
              />
            ))}
          </ContentGrid>
        </section>
      ) : null}

      {/* Omitted entirely (heading included) when no recipe uses this item
          as an ingredient — never a public empty state. */}
      {item.recipeIngredients.length > 0 ? (
        <section>
          <SectionHeading>Used as an ingredient in</SectionHeading>

          <ContentGrid>
            {item.recipeIngredients.map((ingredient) => (
              <Card
                key={ingredient.id}
                title={ingredient.recipe.name}
                description={`${ingredient.quantity}x required.`}
                href={`/recipes/${ingredient.recipe.slug}`}
              />
            ))}
          </ContentGrid>
        </section>
      ) : null}
    </AppShell>
  );
}
