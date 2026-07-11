import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminUser();

  return (
    <AppShell>
      <PageHeader
        title="Admin"
        description="This area is protected by server-side authorization. Editing tools for game data will be added in later steps of this milestone."
      />

      <div
        style={{
          border: `1px solid ${designTokens.colors.border}`,
          borderRadius: designTokens.radius.md,
          background: designTokens.colors.surface,
          padding: "24px",
          display: "grid",
          gap: "16px",
          maxWidth: "480px",
        }}
      >
        <p style={{ margin: 0 }}>
          Signed in as{" "}
          <strong style={{ color: designTokens.colors.accent }}>
            {user.email}
          </strong>
        </p>

        <p style={{ margin: 0 }}>
          <a
            href="/admin/categories"
            style={{ color: designTokens.colors.accent }}
          >
            Manage Categories &rarr;
          </a>
        </p>

        <p style={{ margin: 0 }}>
          <a
            href="/admin/professions"
            style={{ color: designTokens.colors.accent }}
          >
            Manage Professions &rarr;
          </a>
        </p>

        <p style={{ margin: 0 }}>
          <a
            href="/admin/items"
            style={{ color: designTokens.colors.accent }}
          >
            Manage Items &rarr;
          </a>
        </p>

        <p style={{ margin: 0 }}>
          <a
            href="/admin/recipes"
            style={{ color: designTokens.colors.accent }}
          >
            Manage Recipes &rarr;
          </a>
        </p>

        <form action={signOutAction}>
          <button
            type="submit"
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.sm,
              background: designTokens.colors.surfaceSoft,
              color: designTokens.colors.text,
              padding: "10px 16px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </AppShell>
  );
}
