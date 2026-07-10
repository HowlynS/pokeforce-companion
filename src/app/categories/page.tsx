import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function CategoriesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Categories"
        description="Navigate item and recipe categories for faster browsing."
      />

      <EmptyState
        title="No categories yet"
        description="Categories will be added once the core content structure is ready."
      />
    </AppShell>
  );
}
