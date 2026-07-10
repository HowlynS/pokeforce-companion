import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ItemsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Items"
        description="Browse items, materials, and useful crafting resources."
      />

      <EmptyState
        title="No items yet"
        description="Item data will be added during the data model and content milestones."
      />
    </AppShell>
  );
}
