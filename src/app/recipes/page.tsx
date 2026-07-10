import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function RecipesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Recipes"
        description="Explore crafting recipes and the ingredients they require."
      />

      <EmptyState
        title="No recipes yet"
        description="Recipe data will be added after the initial data structure is defined."
      />
    </AppShell>
  );
}
