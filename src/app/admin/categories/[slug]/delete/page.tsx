import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { deleteCategoryAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteCategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

function describeLinkedItems(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

export default async function DeleteCategoryPage({
  params,
  searchParams,
}: DeleteCategoryPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: { _count: { select: { items: true } } },
  });

  if (!category) {
    notFound();
  }

  const itemCount = category._count.items;
  const canDelete = itemCount === 0;

  return (
    <AppShell>
      <PageHeader
        title="Delete Category"
        description={`Review before permanently deleting "${category.name}".`}
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin/categories" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Category Management
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
          {error === "linked_items"
            ? `This category cannot be deleted because it is assigned to ${describeLinkedItems(
                itemCount
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
          <strong>{category.name}</strong> ({category.slug}). This action
          cannot be undone.
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Linked items: {itemCount}
        </p>

        {!canDelete ? (
          <p style={{ margin: 0, color: designTokens.colors.danger }}>
            This category cannot be deleted because it is assigned to{" "}
            {describeLinkedItems(itemCount)}. Reassign or remove those items
            first.
          </p>
        ) : null}

        <div style={{ display: "flex", gap: "12px" }}>
          {canDelete ? (
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <input type="hidden" name="slug" value={category.slug} />
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
            href="/admin/categories"
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
