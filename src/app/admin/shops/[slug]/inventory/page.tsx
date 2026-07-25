import { notFound } from "next/navigation";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import {
  ShopInventoryEditor,
  type ShopInventoryListing,
} from "@/components/admin/shop-inventory-editor";
import { ShopWorkspace } from "@/components/admin/shop-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import {
  SHOP_LIST_PATH,
  normalizeShopSearchQuery,
  shopEditorTabs,
  shopInventoryHref,
  withShopSearchQuery,
} from "@/lib/admin/shop-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { toEntitySelectOptions } from "@/lib/admin/entity-select-options";
import { updateShopInventoryAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_item: "Each active listing needs an Item.",
  missing_currency: "Each active listing needs a Currency.",
  invalid_price: "Prices must be whole numbers greater than zero.",
  duplicate_listing:
    "This Shop already has the same Item and Currency combination. Use a different Currency or edit the existing row.",
  invalid_inventory:
    "The submitted Inventory rows were invalid. Refresh the page and try again.",
  invalid_listing:
    "One or more listings do not belong to this Shop. Refresh the page and try again.",
  invalid_item:
    "One or more selected Items no longer exist. Review the rows and try again.",
  invalid_currency:
    "One or more selected Currencies no longer exist. Review the rows and try again.",
  relation_changed:
    "An Item, Currency, or listing changed while this Inventory was being saved. Review the rows and try again.",
  missing_shop: "That Shop no longer exists.",
  no_current_version:
    "No Game Version is marked as current, so a listing cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "A selected Game Version no longer exists. Refresh the page and try again.",
};

type ShopInventoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function ShopInventoryPage({
  params,
  searchParams,
}: ShopInventoryPageProps) {
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const query = normalizeShopSearchQuery(q);
  const errorMessage = error
    ? errorMessages[error] ?? "Something went wrong."
    : null;

  const [shop, items, currencies, gameVersions] = await Promise.all([
    prisma.shop.findUnique({
      where: { slug },
      include: {
        listings: {
          include: {
            item: { select: { name: true } },
            verifiedGameVersion: { select: { name: true } },
          },
          orderBy: [{ item: { name: "asc" } }, { currency: { name: "asc" } }],
        },
      },
    }),
    prisma.item.findMany({
      select: { id: true, name: true, image: true },
      orderBy: { name: "asc" },
    }),
    prisma.currency.findMany({
      select: { id: true, name: true, symbol: true, image: true },
      orderBy: { name: "asc" },
    }),
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!shop) {
    notFound();
  }

  const [itemOptions, baseCurrencyOptions] = await Promise.all([
    toEntitySelectOptions(items),
    toEntitySelectOptions(currencies),
  ]);
  const currencyOptions = baseCurrencyOptions.map((option, index) => ({
    ...option,
    label: currencies[index]?.symbol
      ? `${option.label} (${currencies[index].symbol})`
      : option.label,
  }));
  const listings: ShopInventoryListing[] = shop.listings.map((listing) => ({
    id: listing.id,
    itemId: listing.itemId,
    itemName: listing.item.name,
    currencyId: listing.currencyId,
    priceAmount: listing.priceAmount,
    notes: listing.notes,
    verifiedAt: listing.verifiedAt?.toISOString() ?? null,
    verifiedGameVersion: listing.verifiedGameVersion,
  }));
  const tabs = shopEditorTabs(
    shop.slug,
    query,
    "inventory",
    listings.length
  );

  return (
    <ShopWorkspace
      key={shop.updatedAt.toISOString()}
      rawQuery={q}
      selectedSlug={shop.slug}
      recordHref={shopInventoryHref}
      editorHeader={
        <>
          <EditorHeader eyebrow="Shop" title={shop.name} subtitle={shop.slug} />
          <EditorTabs label="Shop editor sections" tabs={tabs} />
          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      <div className="admin-editor-surface">
        {items.length === 0 || currencies.length === 0 ? (
          <EmptyState
            title="Inventory needs Items and Currencies"
            description={
              currencies.length === 0
                ? "Create a Currency before adding a Shop listing."
                : "Create an Item before adding a Shop listing."
            }
            action={
              <a
                className="btn btn-primary"
                href={
                  currencies.length === 0
                    ? "/admin/settings/currencies/new"
                    : "/admin/items/new"
                }
              >
                {currencies.length === 0
                  ? "Create Currency"
                  : "Create Item"}
              </a>
            }
          />
        ) : (
          <ShopInventoryEditor
            key={shop.updatedAt.toISOString()}
            action={updateShopInventoryAction}
            shopId={shop.id}
            shopSlug={shop.slug}
            query={query}
            cancelHref={withShopSearchQuery(SHOP_LIST_PATH, query)}
            serverUpdatedAt={shop.updatedAt.toISOString()}
            listings={listings}
            itemOptions={itemOptions}
            currencyOptions={currencyOptions}
            gameVersions={gameVersions}
          />
        )}
      </div>
    </ShopWorkspace>
  );
}
