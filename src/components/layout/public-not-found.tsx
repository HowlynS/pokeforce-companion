import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";

export function PublicNotFound() {
  return (
    <AppShell>
      <PageHeader
        title="This page could not be found."
        description="The requested public reference may have moved or may no longer be available."
      />
    </AppShell>
  );
}
