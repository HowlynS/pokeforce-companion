import { PageHeader } from "@/components/layout/page-header";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { ContentGrid } from "@/components/ui/content-grid";
import { ContextPanel } from "@/components/admin/context-panel";
import { DashboardSummaryCard } from "@/components/admin/dashboard-summary-card";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getCurrentGameVersion } from "@/lib/game-versions";
import {
  DASHBOARD_RESOURCE_ROUTES,
  describeCurrentGameVersion,
  pluralize,
} from "@/lib/admin/dashboard";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminUser();

  // Every count below is a restrained COUNT query — never a full
  // collection load — and every one is independent of the others, so
  // Promise.all runs them concurrently: nine count()s plus one
  // findFirst() (the existing getCurrentGameVersion() helper the
  // settings page and every verification stamp already use, so "the
  // current version" is defined in exactly one place). No per-row
  // queries, no N+1 behavior, no full Item/Recipe/Location collections
  // loaded merely to count them.
  const [
    itemCount,
    acquisitionSourceCount,
    recipeCount,
    recipeIngredientCount,
    professionCount,
    categoryCount,
    locationCount,
    rootLocationCount,
    gameVersionCount,
    currentGameVersion,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.acquisitionSource.count(),
    prisma.recipe.count(),
    prisma.recipeIngredient.count(),
    prisma.profession.count(),
    prisma.category.count(),
    prisma.location.count(),
    prisma.location.count({ where: { parentId: null } }),
    prisma.gameVersion.count(),
    getCurrentGameVersion(prisma),
  ]);

  // The admin dashboard (Slice 9G.1): a restrained workspace summary, not
  // an analytics dashboard — administrative counts and direct navigation
  // only. No charts, no graphs, no trend indicators, no fake percentages,
  // and no "recent activity" feed (there is no real audit history to
  // report). Every count is a real database count; zero is itself
  // meaningful and always renders as 0, never hidden.
  return (
    <AdminWorkspace
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Dashboard"
            description="A restrained summary of the wiki's current reference data, with direct navigation into each completed workspace."
          />

          <section className="admin-toolbar">
            <p>
              Signed in as{" "}
              <strong className="text-accent">{user.email}</strong>
            </p>

            <form action={signOutAction}>
              <button type="submit" className="btn btn-secondary btn-compact">
                Sign out
              </button>
            </form>
          </section>
        </>
      }
    >
      <ContentGrid>
        <DashboardSummaryCard
          title="Items"
          href="/admin/items"
          count={itemCount}
          unitLabel={pluralize(itemCount, "item")}
          context={`${acquisitionSourceCount} ${pluralize(
            acquisitionSourceCount,
            "acquisition source"
          )}`}
        />
        <DashboardSummaryCard
          title="Recipes"
          href="/admin/recipes"
          count={recipeCount}
          unitLabel={pluralize(recipeCount, "recipe")}
          context={`${recipeIngredientCount} ${pluralize(
            recipeIngredientCount,
            "ingredient"
          )}`}
        />
        <DashboardSummaryCard
          title="Professions"
          href="/admin/professions"
          count={professionCount}
          unitLabel={pluralize(professionCount, "profession")}
        />
        <DashboardSummaryCard
          title="Categories"
          href="/admin/categories"
          count={categoryCount}
          unitLabel={pluralize(categoryCount, "category", "categories")}
        />
        <DashboardSummaryCard
          title="Locations"
          href="/admin/locations"
          count={locationCount}
          unitLabel={pluralize(locationCount, "location")}
          context={`${rootLocationCount} root ${pluralize(
            rootLocationCount,
            "location"
          )}`}
        />
      </ContentGrid>

      {/* Read-only administrative status, never fabricated: the current
          version's own name, or a plain "no current version" status —
          the exact same getCurrentGameVersion() semantics every
          verification stamp on the site already relies on. */}
      <ContextPanel
        title="Game Version"
        footer={
          <a href="/admin/settings/game-versions" className="link-accent">
            Game Versions
          </a>
        }
      >
        <dl className="admin-panel-dl">
          <div className="admin-panel-row">
            <dt>Current version</dt>
            <dd>{describeCurrentGameVersion(currentGameVersion)}</dd>
          </div>

          <div className="admin-panel-row">
            <dt>Total versions</dt>
            <dd>{gameVersionCount}</dd>
          </div>
        </dl>
      </ContextPanel>

      <section style={{ marginTop: designTokens.layout.sectionGap }}>
        <h2 className="section-title">Quick Actions</h2>

        <nav aria-label="Quick create actions" className="form-actions">
          {DASHBOARD_RESOURCE_ROUTES.map((route) => (
            <a
              key={route.key}
              href={route.createHref}
              className="btn btn-secondary btn-compact"
            >
              {route.createLabel}
            </a>
          ))}
        </nav>
      </section>
    </AdminWorkspace>
  );
}
