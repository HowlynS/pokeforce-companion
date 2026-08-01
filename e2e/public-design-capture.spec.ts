import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  buildPublicDesignCaptureMatrix,
  createPublicDesignCaptureManifest,
  getPublicDesignCaptureOutputDirectory,
  type PublicDesignCaptureFilters,
  type PublicDesignCaptureResult,
} from "../src/lib/public-design/capture";

test.skip(
  process.env.PUBLIC_DESIGN_CAPTURE !== "1",
  "Run through pnpm public:design:capture so fixtures and output guards are active."
);

test("captures the selected public design matrix and writes its manifest", async ({
  page,
}) => {
  test.setTimeout(0);
  const runId = process.env.PUBLIC_DESIGN_CAPTURE_RUN_ID;
  if (!runId) throw new Error("PUBLIC_DESIGN_CAPTURE_RUN_ID is required.");

  const filters = JSON.parse(
    process.env.PUBLIC_DESIGN_CAPTURE_FILTERS ?? "{}"
  ) as PublicDesignCaptureFilters;
  const matrix = buildPublicDesignCaptureMatrix(filters);
  const relativeOutputDirectory = getPublicDesignCaptureOutputDirectory(runId);
  const outputDirectory = path.resolve(process.cwd(), relativeOutputDirectory);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const results: PublicDesignCaptureResult[] = [];

  for (const entry of matrix) {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    const onConsole = (message: { type(): string; text(): string }) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    };
    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    let status: number | null = null;
    let dimensions: PublicDesignCaptureResult["dimensions"] = null;
    let failure: string | null = null;
    const screenshotPath = entry.filename;

    try {
      await page.setViewportSize({ width: entry.width, height: entry.height });
      const response = await page.goto(entry.route, {
        waitUntil: "domcontentloaded",
      });
      status = response?.status() ?? null;
      const expectedStatus = entry.contractId === "not-found" ? 404 : 200;
      if (status !== expectedStatus) {
        throw new Error(
          `Expected HTTP ${expectedStatus} for ${entry.route}, received ${status ?? "no response"}.`
        );
      }

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
      });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      await page.screenshot({
        path: path.join(outputDirectory, screenshotPath),
        fullPage: true,
        animations: "disabled",
        style: "nextjs-portal { display: none !important; }",
      });
      if (pageErrors.length > 0) {
        throw new Error(`Uncaught page errors: ${pageErrors.join(" | ")}`);
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : "Unknown capture failure";
    } finally {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }

    results.push({
      ...entry,
      screenshotPath,
      capturedAt: new Date().toISOString(),
      status,
      success: failure === null,
      failure,
      pageErrors,
      consoleErrors,
      dimensions,
      horizontalOverflow: dimensions
        ? dimensions.scrollWidth > dimensions.clientWidth
        : null,
    });
  }

  const manifest = createPublicDesignCaptureManifest(runId, filters, results);
  const manifestPath = path.join(outputDirectory, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Public design capture manifest: ${path.relative(process.cwd(), manifestPath)}\n`
  );

  expect(
    manifest.entries.filter((entry) => !entry.success),
    `Capture failures are recorded in ${path.relative(process.cwd(), manifestPath)}`
  ).toEqual([]);
});
