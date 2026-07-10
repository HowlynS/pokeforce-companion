import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ContentGrid } from "@/components/ui/content-grid";
import { designTokens } from "@/lib/design-tokens";

export default function Home() {
  return (
    <AppShell>
      <PageHeader
        title="PokeForce Companion"
        description="A crafting wiki companion for browsing items, recipes, professions, and categories."
      />

      <ContentGrid>
        <Card
          title="Items"
          description="Browse materials, resources, and useful item references."
          href="/items"
        />
        <Card
          title="Recipes"
          description="Explore crafting recipes and their required ingredients."
          href="/recipes"
        />
        <Card
          title="Professions"
          description="Review crafting paths and profession-related content."
          href="/professions"
        />
        <Card
          title="Categories"
          description="Navigate grouped content faster with clear categories."
          href="/categories"
        />
      </ContentGrid>

      <section
        style={{
          border: `1px solid ${designTokens.colors.border}`,
          borderRadius: designTokens.radius.lg,
          background: designTokens.colors.surfaceSoft,
          padding: "24px",
        }}
      >
        <p
          style={{
            margin: 0,
            color: designTokens.colors.textMuted,
            fontSize: "16px",
            lineHeight: 1.6,
          }}
        >
          Milestone 2 is setting up the visual foundation only. Data, search,
          admin editing, images, storage, and deployment will come in later
          milestones.
        </p>
      </section>
    </AppShell>
  );
}
