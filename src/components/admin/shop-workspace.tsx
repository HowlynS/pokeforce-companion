import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import {
  SHOP_CREATE_PATH,
  SHOP_LIST_PATH,
  normalizeShopSearchQuery,
  shopEditHref,
  withShopSearchQuery,
} from "@/lib/admin/shop-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";

type ShopWorkspaceProps = {
  rawQuery?: string;
  selectedSlug?: string;
  header?: React.ReactNode;
  editorHeader?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  recordHref?: (slug: string, query: string) => string;
};

export async function ShopWorkspace({
  rawQuery,
  selectedSlug,
  header,
  editorHeader,
  children,
  aside,
  recordHref = shopEditHref,
}: ShopWorkspaceProps) {
  const query = normalizeShopSearchQuery(rawQuery);
  const shops = await prisma.shop.findMany({
    include: {
      location: { select: { name: true } },
      _count: { select: { listings: true } },
    },
    orderBy: [{ name: "asc" }, { slug: "asc" }],
  });
  const imageUrls = await Promise.all(
    shops.map((shop) => getImagePublicUrl(shop.image))
  );

  const rows = shops.map((shop, index) => ({
    href: recordHref(shop.slug, query),
    primary: shop.name,
    slug: shop.slug,
    secondary: `${shop.location.name} · ${shop._count.listings} ${
      shop._count.listings === 1 ? "listing" : "listings"
    }`,
    searchTerms: [shop.location.name],
    selected: shop.slug === selectedSlug,
    image: imageUrls[index],
  }));

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Shops"
          listPath={SHOP_LIST_PATH}
          initialQuery={query}
          searchLabel="Search shops"
          createHref={withShopSearchQuery(SHOP_CREATE_PATH, query)}
          createLabel="+ New"
          rows={rows}
          showImages
          noun={{ singular: "shop", plural: "shops" }}
          empty={
            <p>
              No shops yet. Use &ldquo;+ New&rdquo; to create the first one.
            </p>
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
