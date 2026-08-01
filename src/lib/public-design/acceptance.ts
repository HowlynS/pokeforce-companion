import { PUBLIC_DESIGN_CONTRACTS } from "@/lib/public-design/contracts";
import { getPublicDesignFixture } from "@/lib/public-design/fixtures";
import { getPublicDesignViewport } from "@/lib/public-design/viewports";

export type PublicDesignAcceptanceEntry = {
  id: string;
  contractId: string;
  fixtureKey: string;
  viewportId: string;
  scenicBackground: "present" | "absent";
  headerMode: "desktop" | "wrapped";
  cardColumns: string;
  sidebarMode: "side-by-side" | "stacked" | "not-applicable";
  visibleRegions: readonly string[];
  hiddenWhenEmpty: readonly string[];
  imageState: string;
  richTextNodes: string;
  pagination: "when-multiple-pages" | "none";
  interaction: readonly string[];
  overflow: "must-not-overflow";
};

function cardColumns(contractId: string, width: number): string {
  if (!contractId.endsWith("-index") && contractId !== "search") return "not-applicable";
  if (width <= 390) return "1";
  if (contractId === "recipes-index") return width <= 1180 ? "2" : "3";
  return "responsive auto-fit";
}

function sidebarMode(contractId: string, width: number): PublicDesignAcceptanceEntry["sidebarMode"] {
  if (contractId !== "item-detail" && contractId !== "recipe-detail") return "not-applicable";
  return width <= 1040 ? "stacked" : "side-by-side";
}

export const PUBLIC_DESIGN_ACCEPTANCE_MATRIX = PUBLIC_DESIGN_CONTRACTS.flatMap(
  (contract): PublicDesignAcceptanceEntry[] =>
    contract.viewports.map((viewportId) => {
      const fixture = getPublicDesignFixture(contract.representativeFixture);
      const viewport = getPublicDesignViewport(viewportId);
      if (!fixture || !viewport) throw new Error(`Acceptance metadata is missing for ${contract.id}/${viewportId}.`);

      return {
        id: `${contract.id}--${fixture.key}--${viewport.id}`,
        contractId: contract.id,
        fixtureKey: fixture.key,
        viewportId: viewport.id,
        scenicBackground: contract.scenicVariant === "none" ? "absent" : "present",
        headerMode: viewport.width <= 1120 ? "wrapped" : "desktop",
        cardColumns: cardColumns(contract.id, viewport.width),
        sidebarMode: sidebarMode(contract.id, viewport.width),
        visibleRegions: contract.requiredRegions,
        hiddenWhenEmpty: contract.optionalRegions,
        imageState: contract.imageRequirement,
        richTextNodes: contract.richTextRequirement,
        pagination:
          contract.id === "items-index" || contract.id === "recipes-index"
            ? "when-multiple-pages"
            : "none",
        interaction: contract.interactions,
        overflow: "must-not-overflow",
      };
    })
);

export function validatePublicDesignAcceptanceMatrix(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const expected = new Set(
    PUBLIC_DESIGN_CONTRACTS.flatMap((contract) =>
      contract.viewports.map((viewportId) =>
        `${contract.id}--${contract.representativeFixture}--${viewportId}`
      )
    )
  );
  for (const entry of PUBLIC_DESIGN_ACCEPTANCE_MATRIX) {
    if (ids.has(entry.id)) errors.push(`Duplicate acceptance ID: ${entry.id}`);
    ids.add(entry.id);
    if (!expected.has(entry.id)) errors.push(`Unexpected acceptance entry: ${entry.id}`);
    if (entry.visibleRegions.length === 0 || entry.interaction.length === 0) errors.push(`Incomplete acceptance entry: ${entry.id}`);
  }
  for (const id of expected) if (!ids.has(id)) errors.push(`Missing acceptance entry: ${id}`);
  return errors;
}
