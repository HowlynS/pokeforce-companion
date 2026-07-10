import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";

export default function CategoriesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Categories"
        description="Navigate item and recipe categories for faster browsing."
      />
    </AppShell>
  );
}
