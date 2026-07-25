import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import { DeleteRecordDialog } from "@/components/admin/delete-record-dialog";
import { requireAdminUser } from "@/lib/auth/require-admin";
import {
  describeItemDeletionReferences,
  itemCanDelete,
  itemEditHref,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { prisma } from "@/lib/db";
import { deleteItemAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteItemPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function DeleteItemPage({
  params,
  searchParams,
}: DeleteItemPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const query = normalizeItemSearchQuery(q);

  const item = await prisma.item.findUnique({
    where: { slug },
    include: {
      category: true,
      _count: {
        select: {
          recipesProduced: true,
          recipeIngredients: true,
          shopListings: true,
        },
      },
    },
  });

  if (!item) {
    notFound();
  }

  const resultCount = item._count.recipesProduced;
  const ingredientCount = item._count.recipeIngredients;
  const shopListingCount = item._count.shopListings;
  const canDelete = itemCanDelete({
    recipesProduced: resultCount,
    recipeIngredients: ingredientCount,
    shopListings: shopListingCount,
  });

  // Inside the Item workspace (Slice 9B.4): the record list marks the
  // item being deleted; Cancel returns to its edit page and the back link
  // to the (still-filtered) list. The confirmation flow itself — live
  // reference counts, the withheld delete button, the re-checked server
  // action — is unchanged.
  return (
    <ItemWorkspace
      rawQuery={q}
      selectedSlug={item.slug}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Delete Item"
            description={`Review before permanently deleting "${item.name}".`}
          />

          <p className="admin-toolbar">
            <a
              href={withItemSearchQuery("/admin/items", query)}
              className="link-accent"
            >
              &larr; Back to Item Management
            </a>
          </p>

          {error ? (
            <p role="alert" className="banner banner-error">
              {[
                "linked_recipes",
                "linked_shop_listings",
                "linked_dependencies",
              ].includes(error)
                ? `This item cannot be deleted because it is referenced by ${describeItemDeletionReferences(
                    {
                      recipesProduced: resultCount,
                      recipeIngredients: ingredientCount,
                      shopListings: shopListingCount,
                    }
                  )}.`
                : "Something went wrong."}
            </p>
          ) : null}
        </>
      }
    >
      <DeleteRecordDialog
        title="Delete Item"
        description={
          <>
            You are about to permanently delete <strong>{item.name}</strong>{" "}
            ({item.slug}). This action cannot be undone.
          </>
        }
        canDelete={canDelete}
        formAction={deleteItemAction}
        hiddenFields={{ id: item.id, slug: item.slug }}
        cancelHref={itemEditHref(item.slug, query)}
      >
        <p className="text-muted">
          Category: {item.category?.name ?? "Uncategorized"}
        </p>

        <p className="text-muted">Used as a recipe result: {resultCount}</p>

        <p className="text-muted">
          Used as a recipe ingredient: {ingredientCount}
        </p>

        <p className="text-muted">
          Referenced by shop listings: {shopListingCount}
        </p>

        {!canDelete ? (
          <p className="text-danger">
            This item cannot be deleted because it is referenced by{" "}
            {describeItemDeletionReferences({
              recipesProduced: resultCount,
              recipeIngredients: ingredientCount,
              shopListings: shopListingCount,
            })}. Remove those references first.
          </p>
        ) : null}
      </DeleteRecordDialog>
    </ItemWorkspace>
  );
}
