import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  countE2eTestCategories,
  deleteE2eTestCategories,
} from "./helpers/database-cleanup";

const CATEGORY_NAME = "Test E2E Rich Description";
const CATEGORY_SLUG = "test-e2e-category-rich-description";

let pageErrors: string[] = [];

test.beforeAll(async () => {
  await deleteE2eTestCategories();
  expect(await countE2eTestCategories()).toBe(0);
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  await deleteE2eTestCategories();
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  expect(await deleteE2eTestCategories()).toBe(0);
});

function descriptionEditor(page: Page): Locator {
  return page.getByRole("textbox", {
    name: "Description (optional)",
    exact: true,
  });
}

async function addFormattedDescription(page: Page) {
  const editor = descriptionEditor(page);
  await expect(editor).toBeEditable();

  await editor.fill("Field guide");
  await page
    .getByRole("button", { name: "Section heading", exact: true })
    .click();

  await editor.press("End");
  await editor.press("Enter");
  await editor.type("Practical notes");
  await page
    .getByRole("button", { name: "Subsection heading", exact: true })
    .click();

  await editor.press("End");
  await editor.press("Enter");
  await editor.press("Control+b");
  await editor.type("Reliable");
  await editor.press("Control+b");
  await editor.type(" methods use ");
  await editor.press("Control+i");
  await editor.type("careful");
  await editor.press("Control+i");
  await editor.type(" preparation.");

  await editor.press("End");
  await editor.press("Enter");
  await page.getByRole("button", { name: "Bulleted list" }).click();
  await editor.type("First step");
  await editor.press("Enter");
  await editor.type("Second step");
  await editor.press("Enter");
  await editor.press("Enter");
  await editor.type("Iron Ore");
  await editor.press("Control+Shift+ArrowLeft");
  await editor.press("Control+Shift+ArrowLeft");
  await page.getByRole("button", { name: "Link", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Add link" });
  await expect(dialog).toBeVisible();
  const resourceSearch = dialog.getByLabel("Find an internal resource");
  await expect(dialog.locator(".rich-link-results")).toHaveCount(0);
  await expect(
    dialog.getByText("No matching resources", { exact: true })
  ).toHaveCount(0);

  await resourceSearch.fill("zzzz-no-matching-resource");
  await expect(
    dialog.getByText("No matching resources", { exact: true })
  ).toBeVisible();
  await expect(dialog.locator(".rich-link-results")).toHaveCount(0);

  await resourceSearch.fill("Iron Ore");
  const result = dialog
    .getByRole("button")
    .filter({ hasText: /^Iron OreItem/ });
  await expect(result).toBeVisible();
  await resourceSearch.press("ArrowDown");
  await expect(result).toBeFocused();
  await result.press("Enter");

  const selectedResource = dialog.getByRole("region", {
    name: "Selected resource",
  });
  await expect(selectedResource).toContainText("Iron Ore");
  await expect(selectedResource).toContainText("Item");
  await expect(selectedResource).toContainText("/items/iron-ore");
  await expect(resourceSearch).toHaveValue("");
  await expect(dialog.locator(".rich-link-results")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Apply link" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(editor.getByRole("link", { name: "Iron Ore" })).toHaveAttribute(
    "href",
    "/items/iron-ore"
  );
}

test("every audited admin description surface uses the shared WYSIWYG field", async ({
  page,
}) => {
  const routes = [
    "/admin/items/new",
    "/admin/professions/new",
    "/admin/classes/new",
    "/admin/categories/new",
    "/admin/locations/new",
    "/admin/settings/currencies/new",
    "/admin/shops/new",
    "/admin/settings/game-versions",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(descriptionEditor(page), route).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "Description formatting" }),
      route
    ).toBeVisible();
    await expect(page.locator('textarea[name="description"]'), route).toHaveCount(
      0
    );
  }
});

test("creates, edits, restores, validates, and publicly renders formatted content", async ({
  page,
}) => {
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill(CATEGORY_NAME);
  await page.getByLabel(/^Page address/).fill(CATEGORY_SLUG);
  await addFormattedDescription(page);

  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create Category" }).click();
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY_SLUG}/edit`);

  await page.goto(`/categories/${CATEGORY_SLUG}`);
  const authored = page.locator(".rich-text-content");
  await expect(authored.getByRole("heading", { level: 2 })).toHaveText(
    "Field guide"
  );
  await expect(authored.getByRole("heading", { level: 3 })).toHaveText(
    "Practical notes"
  );
  await expect(authored.locator("strong")).toHaveText("Reliable");
  await expect(authored.locator("em")).toHaveText("careful");
  await expect(authored.locator("ul li")).toHaveText([
    "First step",
    "Second step",
  ]);
  await expect(authored.getByRole("link", { name: "Iron Ore" })).toHaveAttribute(
    "href",
    "/items/iron-ore"
  );

  await page.goto(`/admin/categories/${CATEGORY_SLUG}/edit`);
  const editor = descriptionEditor(page);
  const editorLink = editor.getByRole("link", { name: "Iron Ore" });
  await expect(editorLink).toBeVisible();

  await editorLink.hover();
  const linkPopover = page.getByRole("dialog", { name: "Link destination" });
  await expect(linkPopover).toBeVisible();
  await expect(linkPopover).toContainText("Iron Ore");
  await expect(linkPopover).toContainText("Item");
  await expect(linkPopover).toContainText("/items/iron-ore");

  const popoverBox = await linkPopover.boundingBox();
  expect(popoverBox).not.toBeNull();
  expect(popoverBox!.x).toBeGreaterThanOrEqual(0);
  expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth)
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Escape");
  await expect(linkPopover).toHaveCount(0);
  const narrowScrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth
  );
  await editorLink.scrollIntoViewIfNeeded();
  await editorLink.hover();
  const narrowPopoverBox = await linkPopover.boundingBox();
  expect(narrowPopoverBox).not.toBeNull();
  expect(narrowPopoverBox!.x).toBeGreaterThanOrEqual(0);
  expect(narrowPopoverBox!.x + narrowPopoverBox!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(narrowScrollWidth);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByLabel("Name", { exact: true }).hover();
  await expect(linkPopover).toHaveCount(0);

  await editorLink.focus();
  await expect(linkPopover).toBeVisible();
  const popoverEditButton = linkPopover.getByRole("button", {
    name: "Edit link",
  });
  await popoverEditButton.focus();
  await expect(popoverEditButton).toBeFocused();
  await page.getByLabel("Name", { exact: true }).focus();
  await expect(linkPopover).toHaveCount(0);

  const editUrl = page.url();
  await editorLink.click();
  await expect(page).toHaveURL(editUrl);
  await expect(linkPopover).toBeVisible();
  await linkPopover.getByRole("button", { name: "Edit link" }).click();

  const editLinkDialog = page.getByRole("dialog", { name: "Edit link" });
  await expect(editLinkDialog).toBeVisible();
  await expect(
    editLinkDialog.getByLabel("Public path or secure external URL")
  ).toHaveValue("/items/iron-ore");
  await page.keyboard.press("Escape");
  await expect(editLinkDialog).toHaveCount(0);

  await editorLink.hover();
  await expect(linkPopover).toBeVisible();
  await linkPopover.getByRole("button", { name: "Remove link" }).click();
  await expect(editor.getByRole("link", { name: "Iron Ore" })).toHaveCount(0);
  await expect(editor).toContainText("Iron Ore");

  await editor.press("Control+End");
  await editor.press("Enter");
  await editor.type("Draft-only underline");
  await editor.press("Shift+Home");
  await page.getByRole("button", { name: "Underline" }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  await page.reload();

  const recoveryDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Restore unsaved draft?" }),
  });
  await expect(recoveryDialog).toBeVisible();
  await recoveryDialog
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(editor.locator("u")).toHaveText("Draft-only underline");

  await page.getByLabel(/^Page address/).fill("materials");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".banner-error")).toContainText(
    "A category with that name or slug already exists."
  );
  await expect(descriptionEditor(page).locator("u")).toHaveText(
    "Draft-only underline"
  );
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  await page.getByLabel(/^Page address/).fill(CATEGORY_SLUG);
  await page.keyboard.press("Control+s");
  await expect(page).toHaveURL(`/admin/categories/${CATEGORY_SLUG}/edit`);
  await page.reload();
  await expect(descriptionEditor(page).locator("u")).toHaveText(
    "Draft-only underline"
  );
});
