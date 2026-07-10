import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ProfessionsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Professions"
        description="Review professions and the crafting paths connected to them."
      />

      <EmptyState
        title="No professions yet"
        description="Profession data will be added when the project reaches the data model milestone."
      />
    </AppShell>
  );
}
