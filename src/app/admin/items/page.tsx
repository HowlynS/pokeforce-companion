import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

// Create-form validation errors now surface on /admin/items/new, where
// the form lives; this landing state only reports outcomes that redirect
// back to the list itself.
const errorMessages: Record<string, string> = {
  missing_item: "That item no longer exists.",
  linked_recipes:
    "That item cannot be deleted while recipes still reference it.",
};

const successMessages: Record<string, string> = {
  created: "Item created.",
  updated: "Item updated.",
  updated_image_cleanup:
    "Item updated, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  deleted: "Item deleted.",
  deleted_image_cleanup:
    "Item deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
};

type AdminItemsPageProps = {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
};

export default async function AdminItemsPage({
  searchParams,
}: AdminItemsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  // The workspace landing state: the searchable record list beside a
  // restrained guidance region — the create form lives on
  // /admin/items/new since Slice 9B.4.
  return (
    <ItemWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Item Management"
            description="Select an item to edit, or create a new one."
          />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p role="status" className="banner banner-success">
              {successMessage}
            </p>
          ) : null}
        </>
      }
    >
      <EmptyState
        title="Select an item"
        description="Choose an item from the list to edit its details, images, sources, and verification — or use “+ New item” to create one."
      />
    </ItemWorkspace>
  );
}
