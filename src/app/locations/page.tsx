import Link from "next/link";
import { ContentImage } from "@/components/content/content-image";
import { DirectoryFilterPopover } from "@/components/content/directory-filter-popover";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { LiveLocationDirectory } from "@/components/content/live-location-directory";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LiveResetLink } from "@/components/content/live-filter-reset";
import { EmptyState } from "@/components/ui/empty-state";
import { readCatalogueQueryValue } from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type LocationType,
} from "@/lib/validation/location";

export const dynamic = "force-dynamic";

type LocationsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
  }>;
};

type DirectoryLocation = {
  id: string;
  name: string;
  slug: string;
  type: LocationType;
  parentId: string | null;
  image: string | null;
  _count: { shops: number };
};

function readLocationTypes(value: string | string[] | undefined): LocationType[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(
      values.filter((entry): entry is LocationType =>
        (LOCATION_TYPES as readonly string[]).includes(entry),
      ),
    ),
  ];
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const { q: rawQuery, type: rawTypes } = await searchParams;
  const searchQuery = readCatalogueQueryValue(rawQuery);
  const normalizedSearchQuery = searchQuery ?? "";
  const selectedTypes = readLocationTypes(rawTypes);
  const locations: DirectoryLocation[] = await prisma.location.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      parentId: true,
      image: true,
      _count: { select: { shops: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const locationsById = new Map(locations.map((location) => [location.id, location]));
  // The type filter stays server-side; the search term is applied live in the
  // browser over these same records, so `?q=` only seeds the field.
  const filteredLocations = locations.filter(
    (location) =>
      selectedTypes.length === 0 || selectedTypes.includes(location.type),
  );

  function findRoot(location: DirectoryLocation): DirectoryLocation {
    let current = location;
    const visited = new Set<string>();
    while (current.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = locationsById.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  const groupMap = new Map<
    string,
    { root: DirectoryLocation; matches: DirectoryLocation[] }
  >();
  for (const location of filteredLocations) {
    const root = findRoot(location);
    const group = groupMap.get(root.id) ?? { root, matches: [] };
    group.matches.push(location);
    groupMap.set(root.id, group);
  }
  const groups = [...groupMap.values()].sort((left, right) =>
    left.root.name.localeCompare(right.root.name),
  );

  const typeFilter = (
    <DirectoryFilterPopover
      label="Location Type"
      paramName="type"
      basePath="/locations"
      options={LOCATION_TYPES.map((type) => ({
        slug: type,
        name: LOCATION_TYPE_LABELS[type],
      }))}
      selectedSlugs={selectedTypes}
      preserve={{ q: searchQuery }}
    />
  );

  const liveGroups = groups.map(({ root, matches }) => ({
    key: root.id,
    title: root.name,
    href: `/locations/${root.slug}`,
    // The root region is itself a record that can match, and matching it keeps
    // its band visible with a count of one — exactly what the server did.
    headingText: root.name,
    subGroups: LOCATION_TYPES.map((type) => ({
      key: type,
      title: LOCATION_TYPE_LABELS[type],
      entries: matches
        .filter(
          (location) => location.id !== root.id && location.type === type,
        )
        .map((location, index) => ({
          key: location.id,
          text: location.name,
          node: (
            <Link
              href={`/locations/${location.slug}`}
              className="location-directory-card cx-item-in"
              key={location.id}
              style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
            >
              <span className="location-directory-card-media">
                <ContentImage
                  imagePath={location.image}
                  alt={`Image of ${location.name}`}
                  size="row"
                />
              </span>
              <span className="location-directory-card-copy">
                <h4>{location.name}</h4>
                <span className="location-directory-card-type">
                  {LOCATION_TYPE_LABELS[location.type]}
                </span>
                <span className="location-directory-card-meta">
                  {location._count.shops === 0
                    ? "No shops"
                    : `${location._count.shops} ${
                        location._count.shops === 1 ? "shop" : "shops"
                      }`}
                </span>
              </span>
            </Link>
          ),
        })),
    })).filter((group) => group.entries.length > 0),
  }));

  const noMatchesState = (
    <div className="directory-empty-state">
      <p className="directory-empty-title">No locations found</p>
      <p className="directory-empty-body">
        Try a different search term or reset your filters.
      </p>
      <LiveResetLink href="/locations" className="directory-empty-reset" queryOnly={selectedTypes.length === 0}>
        Reset filters
      </LiveResetLink>
    </div>
  );

  return (
    <AppShell catalogue scenic="catalogue" wide>
      <div className="directory-page locations-directory-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="Locations" />
        <h1 className="directory-title">Locations</h1>

        <div className="directory-content">
          {locations.length === 0 ? (
            <>
              <div className="directory-toolbar">
                <div className="directory-toolbar-left">
                  <DirectorySearchField
                    basePath="/locations"
                    placeholder="Find a location by name..."
                    defaultValue={searchQuery}
                    preserve={{ type: selectedTypes }}
                  />
                  {typeFilter}
                </div>
              </div>
              <EmptyState
                title="No locations yet"
                description="Locations will be added as the world map is documented."
              />
            </>
          ) : (
            <LiveLocationDirectory
              search={{
                basePath: "/locations",
                placeholder: "Find a location by name...",
                initialQuery: normalizedSearchQuery,
                preserve: { type: selectedTypes },
              }}
              toolbarExtra={typeFilter}
              groupsClassName="location-directory-groups"
              gridClassName="location-directory-grid"
              groups={liveGroups}
              emptyState={noMatchesState}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
