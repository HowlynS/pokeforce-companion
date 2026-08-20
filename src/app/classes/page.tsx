import Link from "next/link";
import { ContentImage } from "@/components/content/content-image";
import { DirectoryOverviewPanel } from "@/components/content/directory-overview-panel";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { DirectoryViewToggle } from "@/components/content/directory-view-toggle";
import {
  LiveMatchCount,
  LiveMatchCountProvider,
} from "@/components/content/live-match-count";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LiveResetLink } from "@/components/content/live-filter-reset";
import { EmptyState } from "@/components/ui/empty-state";
import { readCatalogueQueryValue } from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PlayerClassesPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function PlayerClassesPage({
  searchParams,
}: PlayerClassesPageProps) {
  const { q: rawQuery } = await searchParams;
  const searchQuery = readCatalogueQueryValue(rawQuery);
  // The catalogue filters live in the browser, so `?q=` only seeds the field;
  // every Class is loaded once.
  const [playerClasses, totalClassCount, verifiedClassCount] = await Promise.all([
    prisma.playerClass.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        verifiedAt: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.playerClass.count(),
    prisma.playerClass.count({ where: { verifiedAt: { not: null } } }),
  ]);

  const entries = playerClasses.map((playerClass, index) => ({
    key: playerClass.id,
    text: playerClass.name,
    grid: (
        <Link
          className="class-catalogue-card cx-item-in"
          href={`/classes/${playerClass.slug}`}
          key={playerClass.id}
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
        >
          <span className="class-catalogue-card-media">
            <ContentImage
              imagePath={playerClass.image}
              alt={`Image of ${playerClass.name}`}
              size="card"
            />
          </span>
          <span className="class-catalogue-card-copy">
            <span>
              <h2 className="class-catalogue-card-title">{playerClass.name}</h2>
              <span className="class-catalogue-card-type">Class</span>
            </span>
            {playerClass.description ? (
              <span
                className="class-catalogue-card-description"
                title={playerClass.description}
              >
                {playerClass.description}
              </span>
            ) : null}
            <span className="class-catalogue-card-facts">
              {playerClass.verifiedAt ? "Verified" : "Unverified"}
            </span>
          </span>
        </Link>
    ),
    list: (
        <Link
          className="class-catalogue-list-row cx-item-in"
          href={`/classes/${playerClass.slug}`}
          key={playerClass.id}
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
        >
          <span className="class-catalogue-list-media">
            <ContentImage
              imagePath={playerClass.image}
              alt={`Image of ${playerClass.name}`}
              size="row"
            />
          </span>
          <h2 className="class-catalogue-list-name">{playerClass.name}</h2>
          <span className="class-catalogue-list-type">Class</span>
          <span className="class-catalogue-list-description">
            {playerClass.description ?? ""}
          </span>
          <span className="class-catalogue-list-fact">
            {playerClass.verifiedAt ? "Verified" : "Unverified"}
          </span>
        </Link>
    ),
  }));

  const noMatchesState = (
    <div className="directory-empty-state">
      <p className="directory-empty-title">No classes found</p>
      <p className="directory-empty-body">
        Try a different search term or reset your search.
      </p>
      <LiveResetLink href="/classes" className="directory-empty-reset" queryOnly>
        Reset search
      </LiveResetLink>
    </div>
  );

  return (
    <AppShell catalogue scenic="catalogue" wide>
      <div className="directory-page classes-directory-page">
        <Breadcrumb segments={[{ name: "Home", href: "/" }]} current="Classes" />
        <h1 className="directory-title">Classes</h1>

        <LiveMatchCountProvider>
          <div className="directory-body">
            <div className="directory-content">
              {entries.length > 0 ? (
                <DirectoryViewToggle
                  search={{
                    basePath: "/classes",
                    placeholder: "Find a class by name...",
                    initialQuery: searchQuery ?? "",
                  }}
                  entries={entries}
                  gridShell={{ containerClassName: "class-catalogue-grid" }}
                  listShell={{ containerClassName: "class-catalogue-list" }}
                  emptyState={noMatchesState}
                />
              ) : (
                <>
                  <div className="directory-toolbar">
                    <div className="directory-toolbar-left">
                      <DirectorySearchField
                        basePath="/classes"
                        placeholder="Find a class by name..."
                        defaultValue={searchQuery}
                      />
                    </div>
                  </div>
                  <EmptyState
                    title="No classes yet"
                    description="Class data will be added when the project reaches this milestone."
                  />
                </>
              )}
            </div>

            <DirectoryOverviewPanel
              title="Classes Overview"
              stats={[
                { label: "Total Classes", value: totalClassCount },
                { label: "Verified Entries", value: verifiedClassCount },
                {
                  label: "Matching Now",
                  value: <LiveMatchCount fallback={playerClasses.length} />,
                },
              ]}
            />
          </div>
        </LiveMatchCountProvider>
      </div>
    </AppShell>
  );
}
