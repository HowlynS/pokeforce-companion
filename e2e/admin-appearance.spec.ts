import { expect, test } from "@playwright/test";
import path from "node:path";
import { resetE2eSiteAppearance } from "./helpers/database-cleanup";

test.beforeEach(async () => {
  await resetE2eSiteAppearance();
});

test.afterEach(async () => {
  await resetE2eSiteAppearance();
});

test("Appearance is protected, discoverable, and keeps desktop/mobile crop drafts independent", async ({
  page,
}) => {
  await page.goto("/admin/appearance");

  await expect(
    page.getByRole("heading", { level: 1, name: "Appearance" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Admin navigation" })
      .getByRole("link", { name: "Appearance", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 2, name: "Live public preview" })
  ).toBeVisible();

  const desktop = page.getByRole("button", { name: "Desktop", exact: true });
  const mobile = page.getByRole("button", { name: "Mobile", exact: true });
  await expect(desktop).toHaveAttribute("aria-pressed", "true");

  const x = page.getByLabel("X position");
  const y = page.getByLabel("Y position");
  await x.fill("61");
  await y.fill("58");
  await expect(page.getByText("X 61% · Y 58%")).toBeVisible();
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  await mobile.click();
  await expect(mobile).toHaveAttribute("aria-pressed", "true");
  await expect(x).toHaveValue("82");
  await x.fill("73");

  await desktop.click();
  await expect(x).toHaveValue("61");
  await mobile.click();
  await expect(x).toHaveValue("73");
});

test("dragging the scenic canvas updates the numeric controls and reset restores published values", async ({
  page,
}) => {
  await page.goto("/admin/appearance");

  const x = page.getByLabel("X position");
  const y = page.getByLabel("Y position");
  const originalX = Number(await x.inputValue());
  const originalY = Number(await y.inputValue());
  const dragLayer = page.locator(".appearance-preview-drag-layer");
  await dragLayer.scrollIntoViewIfNeeded();
  const box = await dragLayer.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 - 80,
    box!.y + box!.height / 2 + 40,
    { steps: 5 }
  );
  await page.mouse.up();

  expect(Number(await x.inputValue())).toBeGreaterThan(originalX);
  expect(Number(await y.inputValue())).toBeLessThan(originalY);
  expect(
    await x.evaluate((input: HTMLInputElement) => input.validity.valid)
  ).toBe(true);
  expect(
    await y.evaluate((input: HTMLInputElement) => input.validity.valid)
  ).toBe(true);

  await page
    .getByRole("button", { name: "Reset to published", exact: true })
    .click();
  await expect(x).toHaveValue(String(originalX));
  await expect(y).toHaveValue(String(originalY));
});

test("client asset validation preserves the pending preview and unpublished draft", async ({
  page,
}) => {
  await page.goto("/admin/appearance");
  const fileInput = page.locator('input[name="headerLogoFile"]');
  await fileInput.setInputFiles(path.resolve("e2e/fixtures/tiny-valid.png"));

  await expect(page.locator("#headerLogo-error")).toHaveText(
    "Logo dimensions must be between 32×32 and 4096×4096 pixels."
  );
  await expect(page.getByText("Selected: tiny-valid.png")).toBeVisible();
  await expect(
    page.getByAltText("Draft header logo preview")
  ).toHaveJSProperty("naturalWidth", 1);

  await page.getByRole("button", { name: /Save Appearance/ }).click();
  await expect(page).toHaveURL(/\/admin\/appearance$/);
  await expect(page.getByText("Selected: tiny-valid.png")).toBeVisible();
  expect(
    await fileInput.evaluate(
      (input: HTMLInputElement) => input.validity.valid
    )
  ).toBe(false);
});

test("the editor remains usable without horizontal overflow at every supported admin width", async ({
  page,
}) => {
  for (const viewport of [
    { width: 3440, height: 1440 },
    { width: 1920, height: 1080 },
    { width: 1000, height: 900 },
    { width: 768, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/appearance");
    await expect(
      page.getByRole("heading", { level: 1, name: "Appearance" })
    ).toBeVisible();
    await expect(page.locator(".appearance-preview-stage")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      dimensions.scrollWidth,
      `horizontal overflow at ${viewport.width}px`
    ).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test("one atomic save publishes logo, favicon, and independent scenic settings, then restores defaults", async ({
  page,
}) => {
  await page.goto("/admin/appearance");

  const logo = path.resolve("public/images/branding/merchants-codex-logo.png");
  const wallpaper = logo;
  const favicon = path.resolve(
    "e2e/fixtures/profession-sprites/aetherglass-tonic.png"
  );

  await page.locator('input[name="headerLogoFile"]').setInputFiles(logo);
  await page.locator('input[name="faviconFile"]').setInputFiles(favicon);
  await page.locator('input[name="homeBackgroundFile"]').setInputFiles(wallpaper);
  await page
    .locator('input[name="catalogueBackgroundFile"]')
    .setInputFiles(wallpaper);
  await page
    .locator('input[name="itemDetailBackgroundFile"]')
    .setInputFiles(wallpaper);

  await page.getByLabel("X position").fill("44");
  await page.getByLabel("Y position").fill("61");
  await page
    .getByRole("button", { name: "Items catalogue", exact: true })
    .click();
  await page.getByLabel("X position").fill("52");
  await page.getByLabel("Y position").fill("66");
  await page.getByRole("button", { name: "Item detail", exact: true }).click();
  await page.getByLabel("X position").fill("48");
  await page.getByLabel("Y position").fill("57");

  await page.getByRole("button", { name: /Save Appearance/ }).click();
  await expect(page.getByRole("status")).toHaveText("Appearance published");

  await page.goto("/");
  await expect(page.locator(".public-site-logo")).toHaveAttribute(
    "src",
    /appearance\/header-logo\/.+\.png\?v=\d+/
  );
  await expect(page.locator(".public-scenic-background--home")).toHaveAttribute(
    "style",
    /--public-scenic-position-desktop:\s*44% 61%/
  );
  await expect(page.locator('link[rel~="icon"]')).toHaveAttribute(
    "href",
    /appearance\/favicon\/.+\.png\?v=\d+/
  );

  await page.goto("/items");
  await expect(
    page.locator(".public-scenic-background--catalogue")
  ).toHaveAttribute("style", /--public-scenic-position-desktop:\s*52% 66%/);

  await page.goto("/items/iron-ore");
  await expect(page.locator(".public-scenic-background--detail")).toHaveAttribute(
    "style",
    /--public-scenic-position-desktop:\s*48% 57%/
  );
  await expect(page.locator(".resource-atmosphere--item")).toBeVisible();

  await page.goto("/admin/appearance");
  await page.getByRole("button", { name: "Restore all defaults" }).click();
  await page.getByRole("button", { name: "Restore defaults" }).click();
  await page.getByRole("button", { name: /Save Appearance/ }).click();
  await expect(page.getByRole("status")).toHaveText("Appearance published");

  await page.goto("/");
  await expect(page.locator(".public-site-logo")).toHaveAttribute(
    "src",
    "/images/branding/merchants-codex-logo.png"
  );
  await expect(page.locator('link[rel~="icon"]')).toHaveCount(0);
});
