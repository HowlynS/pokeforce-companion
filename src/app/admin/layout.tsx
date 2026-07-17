import { requireAdminUser } from "@/lib/auth/require-admin";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Server-side gate: unauthenticated visitors are redirected to /login and
  // authenticated non-admin users are denied before anything below renders.
  await requireAdminUser();

  // The shared admin shell (persistent sidebar + content area) wraps every
  // admin route exactly once, here — pages render only their own content
  // and must not wrap themselves in the public AppShell.
  return <AdminShell>{children}</AdminShell>;
}
