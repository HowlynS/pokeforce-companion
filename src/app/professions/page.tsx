import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AppShell } from "@/components/layout/app-shell";
import { ContentImage } from "@/components/content/content-image";
import { DirectoryOverviewPanel } from "@/components/content/directory-overview-panel";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { DirectoryViewToggle } from "@/components/content/directory-view-toggle";
import { LiveResetLink } from "@/components/content/live-filter-reset";
import { EmptyState } from "@/components/ui/empty-state";
import { readCatalogueQueryValue } from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProfessionsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function ProfessionsPage({
  searchParams,
}: ProfessionsPageProps) {
  const { q: rawQuery } = await searchParams;
  const searchQuery = readCatalogueQueryValue(rawQuery);

  // The search term is no longer a database filter: the catalogue is filtered
  // live in the browser, so every Profession is loaded once and `?q=` only
  // seeds the field. Other filters (this page has none) would still be applied
  // server-side.
  const [professions, totalProfessionCount, totalRecipeCount, verifiedCount, levelSummary] =
    await Promise.all([
      prisma.profession.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          image: true,
          _count: { select: { recipes: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.profession.count(),
      prisma.recipe.count({ where: { professionId: { not: null } } }),
      prisma.profession.count({ where: { verifiedAt: { not: null } } }),
      prisma.professionLevel.aggregate({ _max: { level: true } }),
    ]);

  const entries = professions.map((profession, index) => ({
    key: profession.id,
    text: profession.name,
    grid: (
        <Link
          key={profession.id}
          href={`/professions/${profession.slug}`}
          className="profession-catalogue-card cx-item-in"
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
        >
          <span className="profession-catalogue-card-media">
            <ContentImage
              imagePath={profession.image}
              alt={`Image of ${profession.name}`}
              size="card"
            />
          </span>
          <span className="profession-catalogue-card-copy">
            <span>
              <h2 className="profession-catalogue-card-title">
                {profession.name}
              </h2>
              <span className="profession-catalogue-card-type">Profession</span>
            </span>
            {profession.description ? (
              <span
                className="profession-catalogue-card-description"
                title={profession.description}
              >
                {profession.description}
              </span>
            ) : null}
            <span className="profession-catalogue-card-facts">
              <span>
                {profession._count.recipes}{" "}
                {profession._count.recipes === 1 ? "Recipe" : "Recipes"}
              </span>
              {levelSummary._max.level ? (
                <span>Max Lvl {levelSummary._max.level}</span>
              ) : null}
            </span>
          </span>
        </Link>
    ),
    list: (
        <Link
          key={profession.id}
          href={`/professions/${profession.slug}`}
          className="profession-catalogue-list-row cx-item-in"
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
        >
          <span className="profession-catalogue-list-media">
            <ContentImage
              imagePath={profession.image}
              alt={`Image of ${profession.name}`}
              size="row"
            />
          </span>
          <h2 className="profession-catalogue-list-name">{profession.name}</h2>
          <span className="profession-catalogue-list-type">Profession</span>
          <span className="profession-catalogue-list-description">
            {profession.description ?? ""}
          </span>
          <span className="profession-catalogue-list-fact">
            {profession._count.recipes}{" "}
            {profession._count.recipes === 1 ? "Recipe" : "Recipes"}
          </span>
          {levelSummary._max.level ? (
            <span className="profession-catalogue-list-level">
              Max Lvl {levelSummary._max.level}
            </span>
          ) : null}
        </Link>
    ),
  }));

  const noMatchesState = (
    <div className="directory-empty-state">
      <p className="directory-empty-title">No professions found</p>
      <p className="directory-empty-body">
        Try a different search term or reset your search.
      </p>
      <LiveResetLink href="/professions" className="directory-empty-reset" queryOnly>
        Reset search
      </LiveResetLink>
    </div>
  );

  return (
    <AppShell catalogue scenic="catalogue" wide>
      <div className="directory-page professions-directory-page">
        <Breadcrumb
          segments={[{ name: "Home", href: "/" }]}
          current="Professions"
        />
        <h1 className="directory-title">Professions</h1>

        <div className="directory-body">
          <div className="directory-content">
            {entries.length > 0 ? (
              <DirectoryViewToggle
                search={{
                  basePath: "/professions",
                  placeholder: "Find a profession by name...",
                  initialQuery: searchQuery ?? "",
                }}
                entries={entries}
                gridShell={{ containerClassName: "profession-catalogue-grid" }}
                listShell={{ containerClassName: "profession-catalogue-list" }}
                emptyState={noMatchesState}
              />
            ) : (
              <>
                <div className="directory-toolbar">
                  <div className="directory-toolbar-left">
                    <DirectorySearchField
                      basePath="/professions"
                      placeholder="Find a profession by name..."
                      defaultValue={searchQuery}
                    />
                  </div>
                </div>
                <EmptyState
                  title="No professions yet"
                  description="Profession data will be added when the project reaches the data model milestone."
                />
              </>
            )}
          </div>

          <DirectoryOverviewPanel
            title="Professions Overview"
            stats={[
              { label: "Total Professions", value: totalProfessionCount },
              { label: "Recipes", value: totalRecipeCount },
              { label: "Verified Entries", value: verifiedCount },
              ...(levelSummary._max.level
                ? [{ label: "Max Level", value: levelSummary._max.level }]
                : []),
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}
