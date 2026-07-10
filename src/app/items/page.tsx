import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";

export default function ItemsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Items"
        description="Browse items, materials, and useful crafting resources."
      />
    </AppShell>
  );
}
