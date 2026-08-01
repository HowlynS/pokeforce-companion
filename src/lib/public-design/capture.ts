import {
  PUBLIC_DESIGN_CONTRACTS,
  PUBLIC_PAGE_FAMILIES,
  getPublicDesignContract,
  getPublicDesignContractFixtures,
  resolvePublicDesignRoute,
  type PublicPageFamily,
} from "@/lib/public-design/contracts";
import {
  getPublicDesignFixture,
} from "@/lib/public-design/fixtures";
import { getPublicDesignViewport } from "@/lib/public-design/viewports";

export const PUBLIC_DESIGN_CAPTURE_MANIFEST_VERSION = 1;
export const PUBLIC_DESIGN_CAPTURE_ROOT = "test-results/public-design-review";

export type PublicDesignCaptureFilters = {
  contract?: string;
  fixture?: string;
  viewport?: string;
  family?: PublicPageFamily;
};

export type PublicDesignCaptureOptions = {
  filters: PublicDesignCaptureFilters;
  runId: string;
  help: boolean;
};

export type PublicDesignCaptureMatrixEntry = {
  id: string;
  contractId: string;
  contractLabel: string;
  fixtureKey: string;
  fixtureLabel: string;
  family: PublicPageFamily;
  viewportId: string;
  width: number;
  height: number;
  route: string;
  filename: string;
};

export type PublicDesignCaptureResult = PublicDesignCaptureMatrixEntry & {
  screenshotPath: string;
  capturedAt: string;
  status: number | null;
  success: boolean;
  failure: string | null;
  pageErrors: string[];
  consoleErrors: string[];
  dimensions: {
    clientWidth: number;
    scrollWidth: number;
    clientHeight: number;
    scrollHeight: number;
  } | null;
  horizontalOverflow: boolean | null;
};

export type PublicDesignCaptureManifest = {
  version: typeof PUBLIC_DESIGN_CAPTURE_MANIFEST_VERSION;
  runId: string;
  generatedAt: string;
  filters: PublicDesignCaptureFilters;
  requested: number;
  succeeded: number;
  failed: number;
  overflowCount: number;
  entries: PublicDesignCaptureResult[];
};

const FLAG_NAMES = ["contract", "fixture", "viewport", "family", "run-id"] as const;
type FlagName = (typeof FLAG_NAMES)[number];

function isFlagName(value: string): value is FlagName {
  return (FLAG_NAMES as readonly string[]).includes(value);
}

export function createPublicDesignCaptureRunId(date = new Date()): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "z")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function validatePublicDesignCaptureRunId(runId: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(runId)) {
    throw new Error(
      "Capture run ID must contain only lowercase letters, numbers, and single hyphens."
    );
  }
}

export function parsePublicDesignCaptureArgs(
  args: readonly string[],
  defaultRunId = createPublicDesignCaptureRunId()
): PublicDesignCaptureOptions {
  const values = new Map<FlagName, string>();
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected capture argument: ${argument}`);
    }

    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    if (!isFlagName(rawName)) {
      throw new Error(`Unknown capture option: --${rawName}`);
    }
    if (values.has(rawName)) {
      throw new Error(`Capture option --${rawName} may be provided only once.`);
    }

    const value = inlineValue ?? args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Capture option --${rawName} requires a value.`);
    }
    if (inlineValue === undefined) index += 1;
    values.set(rawName, value);
  }

  const family = values.get("family");
  const options: PublicDesignCaptureOptions = {
    filters: {
      contract: values.get("contract"),
      fixture: values.get("fixture"),
      viewport: values.get("viewport"),
      family: family as PublicPageFamily | undefined,
    },
    runId: values.get("run-id") ?? defaultRunId,
    help,
  };

  validatePublicDesignCaptureOptions(options);
  return options;
}

export function validatePublicDesignCaptureOptions(
  options: PublicDesignCaptureOptions
): void {
  validatePublicDesignCaptureRunId(options.runId);
  const { contract, fixture, viewport, family } = options.filters;
  if (contract && !getPublicDesignContract(contract)) {
    throw new Error(`Unknown public design contract: ${contract}`);
  }
  if (fixture && !getPublicDesignFixture(fixture)) {
    throw new Error(`Unknown public design fixture: ${fixture}`);
  }
  if (viewport && !getPublicDesignViewport(viewport)) {
    throw new Error(`Unknown public design viewport: ${viewport}`);
  }
  if (family && !(PUBLIC_PAGE_FAMILIES as readonly string[]).includes(family)) {
    throw new Error(`Unknown public page family: ${family}`);
  }
}

export function getPublicDesignCaptureFilename(
  contractId: string,
  fixtureKey: string,
  viewportId: string
): string {
  return `${contractId}--${fixtureKey}--${viewportId}.png`;
}

export function buildPublicDesignCaptureMatrix(
  filters: PublicDesignCaptureFilters = {}
): PublicDesignCaptureMatrixEntry[] {
  validatePublicDesignCaptureOptions({
    filters,
    runId: "matrix-validation",
    help: false,
  });

  const entries: PublicDesignCaptureMatrixEntry[] = [];
  for (const contract of PUBLIC_DESIGN_CONTRACTS) {
    if (filters.contract && contract.id !== filters.contract) continue;
    if (filters.family && contract.pageFamily !== filters.family) continue;

    for (const fixtureKey of getPublicDesignContractFixtures(contract)) {
      if (filters.fixture && fixtureKey !== filters.fixture) continue;
      const fixture = getPublicDesignFixture(fixtureKey);
      if (!fixture) continue;

      for (const viewportId of contract.viewports) {
        if (filters.viewport && viewportId !== filters.viewport) continue;
        const viewport = getPublicDesignViewport(viewportId);
        if (!viewport) continue;
        const filename = getPublicDesignCaptureFilename(
          contract.id,
          fixture.key,
          viewport.id
        );
        entries.push({
          id: `${contract.id}:${fixture.key}:${viewport.id}`,
          contractId: contract.id,
          contractLabel: contract.label,
          fixtureKey: fixture.key,
          fixtureLabel: fixture.label,
          family: contract.pageFamily,
          viewportId: viewport.id,
          width: viewport.width,
          height: viewport.height,
          route: resolvePublicDesignRoute(contract, fixture),
          filename,
        });
      }
    }
  }

  if (entries.length === 0) {
    throw new Error(
      `No public design captures match filters: ${JSON.stringify(filters)}`
    );
  }
  return entries;
}

export function createPublicDesignCaptureManifest(
  runId: string,
  filters: PublicDesignCaptureFilters,
  entries: PublicDesignCaptureResult[],
  generatedAt = new Date().toISOString()
): PublicDesignCaptureManifest {
  validatePublicDesignCaptureRunId(runId);
  return {
    version: PUBLIC_DESIGN_CAPTURE_MANIFEST_VERSION,
    runId,
    generatedAt,
    filters,
    requested: entries.length,
    succeeded: entries.filter((entry) => entry.success).length,
    failed: entries.filter((entry) => !entry.success).length,
    overflowCount: entries.filter((entry) => entry.horizontalOverflow).length,
    entries,
  };
}

export function getPublicDesignCaptureOutputDirectory(runId: string): string {
  validatePublicDesignCaptureRunId(runId);
  return `${PUBLIC_DESIGN_CAPTURE_ROOT}/${runId}`;
}

export const PUBLIC_DESIGN_CAPTURE_USAGE = `Usage: pnpm public:design:capture [options]

Options:
  --contract <id>   Capture one registered contract
  --fixture <key>   Capture one registered fixture
  --viewport <id>   Capture one registered viewport
  --family <family> Capture one page family
  --run-id <id>     Set the lowercase, hyphenated output run ID
  --help             Show this help
`;
