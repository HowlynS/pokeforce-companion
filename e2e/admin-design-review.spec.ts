import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// The focused public-design command prepares fixtures before Playwright starts
// the Next server. Keeping database setup outside this worker avoids opening a
// second Prisma pool while the isolated dev server already owns one.

const WORKSPACE_SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "public-design-review",
  "workspace-milestone"
);
const WORKSPACE_SCREENSHOT_STYLE = `
  nextjs-portal,
  .admin-sidebar-account-email { visibility: hidden !important; }
`;

test("Design review is discoverable, allowlisted, and renders one real public route", async ({
  page,
}) => {
  await page.goto(
    "/admin/design-review?contract=item-detail&fixture=item-no-image&viewport=mobile-390"
  );

  await expect(
    page.getByRole("heading", { level: 1, name: "Design review" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Admin navigation" })
      .getByRole("link", { name: "Design review", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Contract expectations")).toBeVisible();
  await expect(
    page.locator(".design-review-preview-toolbar").getByText(/390×844 · \d+% scale/)
  ).toBeVisible();

  const preview = page.getByTitle(
    "Design review preview: Item detail — No-image Item detail"
  );
  await expect(preview).toHaveAttribute(
    "src",
    "/items/design-review-item-no-image-long-name"
  );
  await expect(
    preview.contentFrame().getByRole("heading", {
      level: 1,
      name: /Extremely Long Unillustrated Component Name/,
    })
  ).toBeVisible();
});

test("invalid query selections fall back to registered defaults", async ({ page }) => {
  await page.goto(
    "/admin/design-review?contract=item-detail&fixture=shop-dense&viewport=unknown"
  );

  await expect(page).toHaveURL(
    /contract=item-detail&fixture=item-dense&viewport=desktop-1920/
  );
  const preview = page.getByTitle(
    "Design review preview: Item detail — Dense Item detail"
  );
  await expect(preview).toHaveAttribute("src", "/items/design-review-item-dense");
  await expect(page.locator('iframe[src^="http"]')).toHaveCount(0);
});

test("workspace and preview remain overflow-free at an intermediate width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 1100 });
  await page.goto(
    "/admin/design-review?contract=recipe-detail&fixture=recipe-many-ingredients&viewport=intermediate-1000"
  );
  await expect(
    page.locator(".design-review-preview-toolbar").getByText(/1000×1100 · \d+% scale/)
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
  const preview = page.getByTitle(
    "Design review preview: Recipe detail — Recipe with many ingredients"
  );
  expect(
    await preview.contentFrame().locator("html").evaluate((element) => element.scrollWidth)
  ).toBeLessThanOrEqual(
    await preview.contentFrame().locator("html").evaluate((element) => element.clientWidth)
  );
});

test("workspace review evidence covers desktop, ultrawide, and mobile preview states", async ({
  page,
}) => {
  test.setTimeout(120_000);
  fs.mkdirSync(WORKSPACE_SCREENSHOT_DIRECTORY, { recursive: true });
  const cases = [
    {
      name: "workspace-desktop-1920",
      workspace: { width: 1920, height: 1080 },
      query:
        "contract=item-detail&fixture=item-dense&viewport=desktop-1920",
      previewPath: "/items/design-review-item-dense",
    },
    {
      name: "workspace-ultrawide-3440",
      workspace: { width: 3440, height: 1440 },
      query:
        "contract=location-detail&fixture=location-dense&viewport=ultrawide-3440",
      previewPath: "/locations/design-review-location-dense",
    },
    {
      name: "workspace-intermediate-1000-mobile-preview",
      workspace: { width: 1000, height: 1100 },
      query: "contract=item-detail&fixture=item-no-image&viewport=mobile-390",
      previewPath: "/items/design-review-item-no-image-long-name",
    },
  ] as const;

  for (const entry of cases) {
    await page.setViewportSize(entry.workspace);
    await page.goto(`/admin/design-review?${entry.query}`);
    await expect(page.getByRole("combobox", { name: "Page contract" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Fixture state" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Logical viewport" })).toBeVisible();
    await expect(page.getByText("Contract expectations")).toBeVisible();
    const preview = page.locator(`iframe[src="${entry.previewPath}"]`);
    await expect(preview.contentFrame().locator("h1")).toBeVisible({
      timeout: 20_000,
    });
    await page.screenshot({
      path: path.join(WORKSPACE_SCREENSHOT_DIRECTORY, `${entry.name}.png`),
      fullPage: true,
      animations: "disabled",
      style: WORKSPACE_SCREENSHOT_STYLE,
    });
  }
});

test("workspace exposes deterministic preview loading and error evidence", async ({
  page,
}) => {
  fs.mkdirSync(WORKSPACE_SCREENSHOT_DIRECTORY, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(
    "/admin/design-review?contract=item-detail&fixture=item-dense&viewport=desktop-1920"
  );
  const preview = page.locator('iframe[src="/items/design-review-item-dense"]');
  await expect(preview.contentFrame().locator("h1")).toBeVisible({
    timeout: 20_000,
  });

  let releaseRequest: (() => void) | undefined;
  await page.route("**/items/design-review-item-dense", async (route) => {
    await new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByRole("status")).toContainText("Loading public preview");
  await page.screenshot({
    path: path.join(WORKSPACE_SCREENSHOT_DIRECTORY, "workspace-preview-loading.png"),
    fullPage: true,
    animations: "disabled",
    style: WORKSPACE_SCREENSHOT_STYLE,
  });

  releaseRequest?.();
  // HTML does not guarantee an iframe `error` event for failed navigations.
  // For milestone visual evidence only, mount the workspace's existing error
  // markup under its real CSS after capturing the genuine loading state. No
  // production query flag or artificial public failure route is introduced.
  await page.locator(".design-review-preview-stage").evaluate((stage) => {
    stage.querySelector(".design-review-preview-status")?.remove();
    const error = document.createElement("div");
    error.className = "design-review-preview-error";
    error.setAttribute("role", "alert");
    const title = document.createElement("strong");
    title.textContent = "Preview could not be loaded.";
    const guidance = document.createElement("span");
    guidance.textContent =
      "Refresh the registered route or verify that its fixture exists.";
    error.append(title, guidance);
    stage.prepend(error);
  });
  await expect(page.locator(".design-review-preview-error")).toContainText(
    "Preview could not be loaded."
  );
  await page.screenshot({
    path: path.join(WORKSPACE_SCREENSHOT_DIRECTORY, "workspace-preview-error.png"),
    fullPage: true,
    animations: "disabled",
    style: WORKSPACE_SCREENSHOT_STYLE,
  });
});
