import { CurrencyWorkspace } from "@/components/admin/currency-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CURRENCY_CREATE_PATH } from "@/lib/admin/currency-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_currency: "That currency no longer exists.",
};

type CurrencyListPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function CurrencyListPage({
  searchParams,
}: CurrencyListPageProps) {
  await requireAdminUser();
  const { q, error } = await searchParams;
  const count = await prisma.currency.count();
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  return (
    <CurrencyWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin settings"
            title="Currency Management"
            description="Manage the game currencies used for shop prices."
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
        title={count === 0 ? "No currencies yet" : "Select a currency"}
        description={
          count === 0
            ? "Create the first currency before adding structured shop prices."
            : "Choose a currency from the list to edit its details, or create a new one."
        }
        action={
          <a href={CURRENCY_CREATE_PATH} className="btn btn-primary">
            Create Currency
          </a>
        }
      />
    </CurrencyWorkspace>
  );
}
