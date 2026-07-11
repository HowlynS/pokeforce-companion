import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { deleteProfessionAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteProfessionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

function describeLinkedRecipes(count: number): string {
  return count === 1 ? "1 recipe" : `${count} recipes`;
}

export default async function DeleteProfessionPage({
  params,
  searchParams,
}: DeleteProfessionPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;

  const profession = await prisma.profession.findUnique({
    where: { slug },
    include: { _count: { select: { recipes: true } } },
  });

  if (!profession) {
    notFound();
  }

  const recipeCount = profession._count.recipes;
  const canDelete = recipeCount === 0;

  return (
    <AppShell>
      <PageHeader
        title="Delete Profession"
        description={`Review before permanently deleting "${profession.name}".`}
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin/professions" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Profession Management
        </a>
      </p>

      {error ? (
        <p
          role="alert"
          style={{
            border: `1px solid ${designTokens.colors.danger}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.danger,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {error === "linked_recipes"
            ? `This profession cannot be deleted because it is assigned to ${describeLinkedRecipes(
                recipeCount
              )}.`
            : "Something went wrong."}
        </p>
      ) : null}

      <div
        style={{
          border: `1px solid ${designTokens.colors.danger}`,
          borderRadius: designTokens.radius.md,
          background: designTokens.colors.surfaceSoft,
          padding: "24px",
          display: "grid",
          gap: "16px",
          maxWidth: "480px",
        }}
      >
        <p style={{ margin: 0 }}>
          You are about to permanently delete{" "}
          <strong>{profession.name}</strong> ({profession.slug}). This action
          cannot be undone.
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Linked recipes: {recipeCount}
        </p>

        {!canDelete ? (
          <p style={{ margin: 0, color: designTokens.colors.danger }}>
            This profession cannot be deleted because it is assigned to{" "}
            {describeLinkedRecipes(recipeCount)}. Reassign or remove those
            recipes first.
          </p>
        ) : null}

        <div style={{ display: "flex", gap: "12px" }}>
          {canDelete ? (
            <form action={deleteProfessionAction}>
              <input type="hidden" name="id" value={profession.id} />
              <input type="hidden" name="slug" value={profession.slug} />
              <button
                type="submit"
                style={{
                  border: "none",
                  borderRadius: designTokens.radius.sm,
                  background: designTokens.colors.danger,
                  color: designTokens.colors.text,
                  padding: "12px 16px",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Delete Permanently
              </button>
            </form>
          ) : null}

          <a
            href="/admin/professions"
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.sm,
              background: designTokens.colors.surface,
              color: designTokens.colors.text,
              padding: "12px 16px",
              fontSize: "16px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Cancel
          </a>
        </div>
      </div>
    </AppShell>
  );
}
