import { spawn } from "node:child_process";

const UNIT_FILTERS = [
  "src/lib/public-design",
  "src/components/admin/design-review-workspace.test.tsx",
  "src/components/content",
  "src/components/layout/app-shell.test.tsx",
  "src/lib/appearance",
  "src/lib/storage/appearance-assets.test.ts",
  "src/lib/storage/images.test.ts",
  "src/lib/catalogue-query.test.ts",
  "src/lib/recipes",
  "src/lib/rich-text.test.ts",
  "src/lib/search/global-search.test.ts",
  "src/lib/shops/public-shop.test.ts",
  "src/lib/public-verification.test.ts",
] as const;

function runPnpm(args: readonly string[], label: string): Promise<void> {
  const pnpmEntryPoint = process.env.npm_execpath;
  if (!pnpmEntryPoint) {
    throw new Error(
      "pnpm execution metadata is missing; run this command through pnpm."
    );
  }

  process.stdout.write(`\n[public-design] ${label}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [pnpmEntryPoint, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} terminated by signal ${signal}.`));
      } else if (code !== 0) {
        reject(new Error(`${label} failed with exit code ${code ?? 1}.`));
      } else {
        resolve();
      }
    });
  });
}

async function main(): Promise<void> {
  await runPnpm(
    ["exec", "vitest", "run", ...UNIT_FILTERS],
    "focused registry, component, content, and Appearance unit tests"
  );
  await runPnpm(
    [
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.integration.config.ts",
      "src/lib/public-design/fixture-database.integration.test.ts",
    ],
    "guarded public-design fixture integration test"
  );

  await runPnpm(
    ["public:design:fixtures", "setup"],
    "deterministic public-design fixture setup"
  );
  try {
    await runPnpm(
      [
        "exec",
        "playwright",
        "test",
        "e2e/public-design-contracts.spec.ts",
        "e2e/admin-design-review.spec.ts",
        "--project=chromium-private-beta",
        "--project=chromium-admin",
        "--workers=1",
      ],
      "focused authenticated public contracts and Owner Design Review browser tests"
    );
  } finally {
    await runPnpm(
      ["public:design:fixtures", "cleanup"],
      "deterministic public-design fixture cleanup"
    );
  }

  process.stdout.write("\n[public-design] Focused redesign validation passed.\n");
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Public design validation failed."}\n`
  );
  process.exitCode = 1;
});
