import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

const managementAreas = [
  {
    title: "Manage Categories",
    description: "Create, edit, and delete item categories.",
    href: "/admin/categories",
  },
  {
    title: "Manage Professions",
    description: "Create, edit, and delete professions and their images.",
    href: "/admin/professions",
  },
  {
    title: "Manage Items",
    description: "Create, edit, and delete items and their images.",
    href: "/admin/items",
  },
  {
    title: "Manage Recipes",
    description: "Create, edit, and delete crafting recipes.",
    href: "/admin/recipes",
  },
  {
    title: "Manage Locations",
    description: "Create, edit, and delete locations and their images.",
    href: "/admin/locations",
  },
];

export default async function AdminPage() {
  const user = await requireAdminUser();

  return (
    <AppShell>
      <PageHeader
        title="Admin"
        description="Manage the wiki's game data: create, edit, and delete categories, professions, items, recipes, and locations."
      />

      <section className="admin-toolbar">
        <p>
          Signed in as{" "}
          <strong style={{ color: designTokens.colors.accent }}>
            {user.email}
          </strong>
        </p>

        <form action={signOutAction}>
          <button type="submit" className="btn btn-secondary btn-compact">
            Sign out
          </button>
        </form>
      </section>

      <ContentGrid>
        {managementAreas.map((area) => (
          <Card
            key={area.href}
            title={area.title}
            description={area.description}
            href={area.href}
          />
        ))}
      </ContentGrid>

      {/* Deliberately a restrained secondary destination below the primary
          management grid — Game Versions is settings, not day-to-day content
          management, and must not join the primary navigation. */}
      <section style={{ marginTop: designTokens.layout.sectionGap }}>
        <h2 className="section-title">Settings</h2>
        <p>
          <a href="/admin/settings/game-versions" className="link-accent">
            Game Versions
          </a>{" "}
          <span style={{ color: designTokens.colors.textMuted }}>
            — manage the game versions used to verify gameplay data.
          </span>
        </p>
      </section>
    </AppShell>
  );
}
