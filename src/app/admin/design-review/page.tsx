import type { Metadata } from "next";
import { DesignReviewWorkspace } from "@/components/admin/design-review-workspace";
import { EditorHeader } from "@/components/admin/editor-header";
import { getPublishedSiteAppearance } from "@/lib/appearance/public";
import { requirePermission } from "@/lib/auth/authorization";
import {
  PUBLIC_DESIGN_CONTRACTS,
  getPublicDesignContract,
  getPublicDesignContractFixtures,
} from "@/lib/public-design/contracts";
import { getPublicDesignFixture } from "@/lib/public-design/fixtures";
import {
  PUBLIC_DESIGN_VIEWPORTS,
  getPublicDesignViewport,
} from "@/lib/public-design/viewports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Design review | PokeForce Companion",
  robots: { index: false, follow: false },
};

type DesignReviewPageProps = {
  searchParams: Promise<{
    contract?: string | string[];
    fixture?: string | string[];
    viewport?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DesignReviewPage({
  searchParams,
}: DesignReviewPageProps) {
  await requirePermission("site.design-review.view");
  const query = await searchParams;
  const contract =
    getPublicDesignContract(first(query.contract) ?? "") ??
    PUBLIC_DESIGN_CONTRACTS[0];
  const allowedFixtures = getPublicDesignContractFixtures(contract);
  const requestedFixture = getPublicDesignFixture(first(query.fixture) ?? "");
  const fixture =
    requestedFixture && allowedFixtures.includes(requestedFixture.key)
      ? requestedFixture
      : getPublicDesignFixture(contract.representativeFixture)!;
  const requestedViewport = getPublicDesignViewport(first(query.viewport) ?? "");
  const viewport =
    requestedViewport &&
    (contract.viewports as readonly string[]).includes(requestedViewport.id)
      ? requestedViewport
      : PUBLIC_DESIGN_VIEWPORTS.find(({ id }) => id === contract.viewports[0])!;
  const appearance = await getPublishedSiteAppearance();

  return (
    <div className="design-review-page">
      <EditorHeader
        eyebrow="Public site"
        title="Design review"
        subtitle="Inspect one real public route against deterministic fixture and viewport contracts."
      />
      <DesignReviewWorkspace
        initialContractId={contract.id}
        initialFixtureKey={fixture.key}
        initialViewportId={viewport.id}
        appearanceVersion={appearance.version}
      />
    </div>
  );
}
