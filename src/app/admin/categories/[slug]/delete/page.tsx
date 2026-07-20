import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import {
  CATEGORY_LIST_PATH,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";
import { deleteCategoryAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteCategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
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
  const { q, error } = await searchParams;
  const query = normalizeCategorySearchQuery(q);

  const category = await prisma.category.findUnique({
    where: { slug },
    include: { _count: { select: { items: true } } },
  });

  if (!category) {
    notFound();
  }

  const itemCount = category._count.items;
  const canDelete = itemCount === 0;

  // The delete confirmation inside the Category workspace, following the
  // Item/Recipe/Profession workspaces' navigation-foundation precedent:
  // the record list marks this category selected. The confirmation card,
  // its summary, and the delete action are unchanged — only the
  // navigation wrapper moved.
  return (
    <CategoryWorkspace
      rawQuery={q}
      selectedSlug={category.slug}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Delete Category"
            description={`Review before permanently deleting "${category.name}".`}
          />

          <p className="admin-toolbar">
            <a
              href={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Category Management
            </a>
          </p>

          {error ? (
            <p role="alert" className="banner banner-error">
              {error === "linked_items"
                ? `This category cannot be deleted because it is assigned to ${describeLinkedItems(
                    itemCount
                  )}.`
                : "Something went wrong."}
            </p>
          ) : null}
        </>
      }
    >
      <div className="confirm-card">
        <p>
          You are about to permanently delete{" "}
          <strong>{category.name}</strong> ({category.slug}). This action
          cannot be undone.
        </p>

        <p className="text-muted">Linked items: {itemCount}</p>

        {!canDelete ? (
          <p className="text-danger">
            This category cannot be deleted because it is assigned to{" "}
            {describeLinkedItems(itemCount)}. Reassign or remove those items
            first.
          </p>
        ) : null}

        <div className="form-actions">
          {canDelete ? (
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <input type="hidden" name="slug" value={category.slug} />
              <button type="submit" className="btn btn-danger">
                Delete Permanently
              </button>
            </form>
          ) : null}

          <a
            href={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </div>
    </CategoryWorkspace>
  );
}
