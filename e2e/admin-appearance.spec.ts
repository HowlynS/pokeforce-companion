import { expect, test } from "@playwright/test";

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

  await page
    .getByRole("button", { name: "Reset to published", exact: true })
    .click();
  await expect(x).toHaveValue(String(originalX));
  await expect(y).toHaveValue(String(originalY));
});
