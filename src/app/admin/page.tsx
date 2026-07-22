import { PageHeader } from "@/components/layout/page-header";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { DashboardSummaryCard } from "@/components/admin/dashboard-summary-card";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getCurrentGameVersion } from "@/lib/game-versions";
import {
  DASHBOARD_RESOURCE_ROUTES,
  describeCurrentGameVersion,
  pluralize,
} from "@/lib/admin/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming
  // it. The signed-in account card itself moved into AdminShell's sidebar
  // (Visual Pass II Section 8) — this page's own main content no longer
  // renders any account/sign-out UI.
  await requireAdminUser();

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

  const countsByKey: Record<string, { count: number; unit: string; context?: string }> = {
    items: {
      count: itemCount,
      unit: pluralize(itemCount, "item"),
      context: `${acquisitionSourceCount} ${pluralize(
        acquisitionSourceCount,
        "acquisition source"
      )}`,
    },
    recipes: {
      count: recipeCount,
      unit: pluralize(recipeCount, "recipe"),
      context: `${recipeIngredientCount} ${pluralize(
        recipeIngredientCount,
        "ingredient"
      )}`,
    },
    professions: {
      count: professionCount,
      unit: pluralize(professionCount, "profession"),
    },
    categories: {
      count: categoryCount,
      unit: pluralize(categoryCount, "category", "categories"),
    },
    locations: {
      count: locationCount,
      unit: pluralize(locationCount, "location"),
      context: `${rootLocationCount} root ${pluralize(
        rootLocationCount,
        "location"
      )}`,
    },
  };

  // The admin dashboard (Slice 9G.1; restructured in Visual Pass II
  // Section 8): a restrained workspace summary, not an analytics
  // dashboard — administrative counts and direct navigation only. No
  // charts, no graphs, no trend indicators, no fake percentages, and no
  // "recent activity" feed. Every count is a real database count; zero is
  // itself meaningful and always renders as 0, never hidden. The former
  // separate Game Version panel and the Quick Actions section are both
  // gone — Game Versions is now a sixth module in the same grid, and every
  // module's own create action replaces Quick Actions' row of links.
  return (
    <AdminWorkspace
      header={
        <PageHeader
          eyebrow="Admin"
          title="Dashboard"
          description="A restrained summary of the wiki's current reference data, with direct navigation into each completed workspace."
        />
      }
    >
      <section className="admin-dashboard-grid">
        {DASHBOARD_RESOURCE_ROUTES.map((route) => (
          <DashboardSummaryCard
            key={route.key}
            title={route.label}
            href={route.listHref}
            count={countsByKey[route.key].count}
            unitLabel={countsByKey[route.key].unit}
            context={countsByKey[route.key].context}
            createHref={route.createHref}
            createLabel={route.createLabel}
          />
        ))}

        <DashboardSummaryCard
          title="Game Versions"
          href="/admin/settings/game-versions"
          count={gameVersionCount}
          unitLabel={pluralize(gameVersionCount, "version")}
          context={describeCurrentGameVersion(currentGameVersion)}
          createHref="/admin/settings/game-versions#create-game-version"
          createLabel="Create game version"
        />
      </section>
    </AdminWorkspace>
  );
}
