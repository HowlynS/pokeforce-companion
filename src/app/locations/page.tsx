// The public Locations list (Slice 10C): a stable entry point every
// Location detail page's own breadcrumb links back to as its root
// ("Locations" -> /locations), mirroring the existing Items/Recipes/
// Professions/Categories list pages exactly — a flat, alphabetically
// ordered grid, no search or filters. Hierarchy itself is presented on
// each Location's own detail page (breadcrumb, Sub-locations); this list
// deliberately stays flat rather than rendering a nested tree.

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { LOCATION_TYPE_LABELS } from "@/lib/validation/location";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  // Only the fields the list cards need — never verification/Game
  // Version fields, never a database id.
  const locations = await prisma.location.findMany({
    select: { name: true, slug: true, type: true },
    orderBy: [{ name: "asc" }, { slug: "asc" }],
  });

  return (
    <AppShell>
      <PageHeader
        title="Locations"
        description="Browse regions, towns, and other locations across the world."
      />

      {locations.length > 0 ? (
        <ContentGrid>
          {locations.map((location) => (
            <Card
              key={location.slug}
              title={location.name}
              description={LOCATION_TYPE_LABELS[location.type]}
              href={`/locations/${location.slug}`}
            />
          ))}
        </ContentGrid>
      ) : (
        <EmptyState
          title="No locations yet"
          description="Locations will be added as the world map is documented."
        />
      )}
    </AppShell>
  );
}
