import { ShopWorkspace } from "@/components/admin/shop-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SHOP_CREATE_PATH } from "@/lib/admin/shop-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_shop: "That shop no longer exists.",
};

type ShopListPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function ShopListPage({
  searchParams,
}: ShopListPageProps) {
  await requireAdminUser();
  const { q, error } = await searchParams;
  const count = await prisma.shop.count();
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  return (
    <ShopWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Shop Management"
            description="Manage fixed in-game shops and their locations."
          />
          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      <EmptyState
        title={count === 0 ? "No shops yet" : "Select a shop"}
        description={
          count === 0
            ? "Create the first shop to begin documenting structured inventory."
            : "Choose a shop from the list to edit it, or create a new one."
        }
        action={
          <a href={SHOP_CREATE_PATH} className="btn btn-primary">
            Create Shop
          </a>
        }
      />
    </ShopWorkspace>
  );
}
