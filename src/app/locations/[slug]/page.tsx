import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ContentImage } from "@/components/content/content-image";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { prisma } from "@/lib/db";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";

export const dynamic = "force-dynamic";

type LocationDetailPageProps = {
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

export default async function LocationDetailPage({
  params,
}: LocationDetailPageProps) {
  const { slug } = await params;

  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: { orderBy: { name: "asc" } },
    },
  });

  if (!location) {
    notFound();
  }

  // Only meaningful metadata is shown: unset optional fields are omitted
  // rather than rendered as placeholder values. The parent relation gets
  // its own linked card below instead of repeating the name here.
  const details = [`Type: ${LOCATION_TYPE_LABELS[location.type]}`];

  return (
    <AppShell>
      <PageHeader
        title={location.name}
        description={location.description ?? undefined}
      />

      <section className="detail-hero">
        <ContentImage
          imagePath={location.image}
          alt={`Image of ${location.name}`}
          size="detail"
        />

        <div className="detail-hero-facts">
          <Card title="Details" description={details.join(" · ")} />

          {location.parent ? (
            <Card
              title="Parent location"
              description={`Part of ${location.parent.name}.`}
              href={`/locations/${location.parent.slug}`}
            />
          ) : null}

          {location.accessNote ? (
            <Card title="Access" description={location.accessNote} />
          ) : null}

          {/* Verification metadata is deliberately NOT rendered here:
              since Slice 9A, Game Version and verification information is
              admin-only and never appears on public pages. */}
        </div>
      </section>

      {/* The entire section is omitted when there are no children — no
          heading, no empty state — rather than announcing an absence that
          is not (yet) meaningful information for a location page. */}
      {location.children.length > 0 ? (
        <section>
          <SectionHeading>Sub-locations</SectionHeading>

          <ContentGrid>
            {location.children.map((child) => (
              <Card
                key={child.id}
                title={child.name}
                description={LOCATION_TYPE_LABELS[child.type]}
                href={`/locations/${child.slug}`}
              />
            ))}
          </ContentGrid>
        </section>
      ) : null}
    </AppShell>
  );
}
