import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import {
  CURRENCY_CREATE_PATH,
  CURRENCY_LIST_PATH,
  currencyEditHref,
  normalizeCurrencySearchQuery,
  withCurrencySearchQuery,
} from "@/lib/admin/currency-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";

type CurrencyWorkspaceProps = {
  rawQuery?: string;
  selectedSlug?: string;
  header?: React.ReactNode;
  editorHeader?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
};

export async function CurrencyWorkspace({
  rawQuery,
  selectedSlug,
  header,
  editorHeader,
  children,
  aside,
}: CurrencyWorkspaceProps) {
  const query = normalizeCurrencySearchQuery(rawQuery);
  const currencies = await prisma.currency.findMany({
    orderBy: [{ name: "asc" }, { slug: "asc" }],
  });
  const imageUrls = await Promise.all(
    currencies.map((currency) => getImagePublicUrl(currency.image))
  );

  const rows = currencies.map((currency, index) => ({
    href: currencyEditHref(currency.slug, query),
    primary: currency.name,
    slug: currency.slug,
    secondary: currency.symbol || "No symbol",
    selected: currency.slug === selectedSlug,
    image: imageUrls[index],
  }));

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Currencies"
          listPath={CURRENCY_LIST_PATH}
          initialQuery={query}
          searchLabel="Search currencies"
          createHref={withCurrencySearchQuery(CURRENCY_CREATE_PATH, query)}
          createLabel="+ New"
          rows={rows}
          showImages
          noun={{ singular: "currency", plural: "currencies" }}
          empty={
            <p>
              No currencies yet. Use &ldquo;+ New&rdquo; to create the first
              one.
            </p>
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
