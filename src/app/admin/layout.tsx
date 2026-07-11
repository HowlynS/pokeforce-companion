import { requireAdminUser } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Server-side gate: unauthenticated visitors are redirected to /login and
  // authenticated non-admin users are denied before anything below renders.
  await requireAdminUser();

  return <>{children}</>;
}
