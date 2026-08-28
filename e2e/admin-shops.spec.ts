import { expect, test } from "@playwright/test";
import { selectAdminOption } from "./helpers/admin-select";
import {
  countE2eTestShopRecords,
  createE2eShopInventoryFixtures,
  createE2eShopLocation,
  deleteE2eTestShopRecords,
} from "./helpers/database-cleanup";
import { descriptionEditor } from "./helpers/admin-description-field";

const INITIAL = {
  name: "Test E2E Shop",
  slug: "test-e2e-shop",
  description: "Created by the Shop admin browser test.",
} as const;

async function createShopThroughUi(
  page: import("@playwright/test").Page,
  name: string,
  slug: string
) {
  const location = await createE2eShopLocation();
  await page.goto("/admin/shops/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel(/^Page address/).fill(slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Location", exact: true }),
    location.name
  );
  await page.getByRole("button", { name: /Create Shop/ }).click();
  await expect(page).toHaveURL(`/admin/shops/${slug}/edit`);
}

const EDITED = {
  name: "Test E2E Shop Updated",
  slug: "test-e2e-shop-updated",
  description: "Updated in place by the Shop admin browser test.",
} as const;

test.beforeAll(async () => {
  await deleteE2eTestShopRecords();
  await createE2eShopLocation();
  expect(await countE2eTestShopRecords()).toBe(0);
});

test.afterEach(async () => {
  await deleteE2eTestShopRecords();
});

test.afterAll(async () => {
  expect(await deleteE2eTestShopRecords()).toBe(0);
});

test("Shop admin lifecycle requires a Location and uses the shared workspace", async ({
  page,
}) => {
  const location = await createE2eShopLocation();
  await page.goto("/admin/shops");
  await expect(page).toHaveURL("/admin/shops");
  await expect(
    page.getByRole("heading", { level: 1, name: "Shop Management" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Shops", exact: true })
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "+ New", exact: true }).click();
  await expect(page).toHaveURL("/admin/shops/new");
  await page.getByLabel("Name", { exact: true }).fill(INITIAL.name);
  await page.getByLabel(/^Page address/).fill(INITIAL.slug);
  await selectAdminOption(
    page.getByRole("combobox", { name: "Location", exact: true }),
    location.name
  );
  await descriptionEditor(page).fill(INITIAL.description);
  await page.getByRole("button", { name: /Create Shop/ }).click();

  await expect(page).toHaveURL(`/admin/shops/${INITIAL.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Shop created");
  const tabs = page.getByRole("navigation", { name: "Shop editor sections" });
  await expect(
    tabs.getByRole("link", { name: "General", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: /Inventory/ })).toHaveAttribute(
    "href",
    `/admin/shops/${INITIAL.slug}/inventory`
  );

  await page.getByLabel("Name", { exact: true }).fill(EDITED.name);
  await page.getByLabel(/^Page address/).fill(EDITED.slug);
  await descriptionEditor(page).fill(EDITED.description);
  await page.getByRole("button", { name: /Save Changes/ }).click();

  await expect(page).toHaveURL(`/admin/shops/${EDITED.slug}/edit`);
  await expect(page.getByRole("status")).toHaveText("Shop saved");
  await expect(
    page.getByRole("combobox", { name: "Location", exact: true })
  ).toContainText(location.name);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3440, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  }

  await page.getByRole("button", { name: "Delete Shop", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Shop" });
  await dialog
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/shops");
  await expect(page.getByRole("status")).toHaveText("Shop deleted");
  expect(await countE2eTestShopRecords()).toBe(0);
});

test("Shop Inventory supports validation, alternative Currencies, verification, staged removal, drafts, and save in place", async ({
  page,
}) => {
  const fixtures = await createE2eShopInventoryFixtures();
  const slug = "test-e2e-shop-inventory";
  await createShopThroughUi(page, "Test E2E Inventory Shop", slug);

  await page
    .getByRole("navigation", { name: "Shop editor sections" })
    .getByRole("link", { name: /Inventory/ })
    .click();
  await expect(page).toHaveURL(`/admin/shops/${slug}/inventory`);
  await expect(
    page.getByRole("heading", { name: "No inventory listings yet" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Add listing" }).click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  let rows = page.locator(".shop-inventory-row:visible");
  await expect(rows).toHaveCount(1);
  let row = rows.first();
  await expect(
    row.getByRole("heading", { name: "New listing 1", level: 3 })
  ).toBeVisible();
  await selectAdminOption(
    row.getByRole("combobox", { name: "Item", exact: true }),
    fixtures.item.name
  );
  await selectAdminOption(
    row.getByRole("combobox", { name: "Currency", exact: true }),
    `${fixtures.primaryCurrency.name} (₽)`
  );

  // Bypass native constraint validation once to prove the server action
  // independently rejects zero rather than trusting input[min].
  await row.getByLabel("Price amount", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: /Save Inventory/ })
    .evaluate((button: HTMLButtonElement) => {
      const form = button.closest("form");
      if (form) {
        form.noValidate = true;
      }
  });
  await page.getByRole("button", { name: /Save Inventory/ }).click();
  await expect(page).toHaveURL(
    `/admin/shops/${slug}/inventory?error=invalid_price`
  );
  await expect(page.locator(".banner-error")).toContainText(
    "Prices must be whole numbers greater than zero."
  );
  // A server-side validation redirect is no longer treated as abandonment:
  // AdminFormGuard auto-restores the just-submitted draft and keeps the form
  // dirty, so no recovery prompt appears here any more.
  await expect(
    page.getByRole("button", { name: "Restore draft" })
  ).toHaveCount(0);
  row = page.locator(".shop-inventory-row:visible").first();
  await expect(row.getByLabel("Price amount", { exact: true })).toHaveValue("0");

  await row.getByLabel("Price amount", { exact: true }).fill("1250");
  await row
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Available after the tutorial.");
  await page.getByRole("button", { name: /Save Inventory/ }).click();
  await expect(page).toHaveURL(`/admin/shops/${slug}/inventory`);
  await expect(page.getByRole("status")).toHaveText("Shop inventory saved");
  await expect(page.locator(".shop-inventory-row:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();

  // The same Item with a different Currency is a valid second offer.
  await page.getByRole("button", { name: "Add listing" }).click();
  rows = page.locator(".shop-inventory-row:visible");
  await expect(rows).toHaveCount(2);
  row = rows.nth(1);
  await selectAdminOption(
    row.getByRole("combobox", { name: "Item", exact: true }),
    fixtures.item.name
  );
  await selectAdminOption(
    row.getByRole("combobox", { name: "Currency", exact: true }),
    fixtures.alternateCurrency.name
  );
  await row.getByLabel("Price amount", { exact: true }).fill("20");
  await page.getByRole("button", { name: /Save Inventory/ }).click();
  await expect(page.getByRole("status")).toHaveText("Shop inventory saved");
  await expect(page.locator(".shop-inventory-row:visible")).toHaveCount(2);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3440, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const inventoryForm = page.locator("form.shop-inventory-form");
    const visibleListings = page.locator(".shop-inventory-row:visible");
    const listing = visibleListings.first();
    const listingTitle = listing.getByRole("heading", {
      name: fixtures.item.name,
      level: 3,
    });
    await expect(listingTitle).toBeVisible();

    const layout = await page.evaluate(() => {
      const form = document.querySelector<HTMLElement>(
        "form.shop-inventory-form"
      );
      const list = document.querySelector<HTMLElement>(".shop-inventory-list");
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".shop-inventory-row:not([hidden])"
        )
      );
      const title = cards[0]?.querySelector<HTMLElement>(
        ".shop-inventory-row-title"
      );
      const surface = document.querySelector<HTMLElement>(
        ".admin-editor-surface"
      );
      if (!form || !list || cards.length !== 2 || !title || !surface) {
        throw new Error("Inventory layout elements were not rendered.");
      }

      const formRect = form.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const cardRects = cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      });
      const titleRect = title.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const surfaceStyle = getComputedStyle(surface);

      return {
        viewportWidth: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth,
        formWidth: formRect.width,
        listLeft: listRect.left,
        listRight: listRect.right,
        listWidth: listRect.width,
        gridColumns: getComputedStyle(list).gridTemplateColumns.split(" "),
        cards: cardRects,
        surfaceInnerWidth:
          surfaceRect.width -
          Number.parseFloat(surfaceStyle.paddingLeft) -
          Number.parseFloat(surfaceStyle.paddingRight) -
          Number.parseFloat(surfaceStyle.borderLeftWidth) -
          Number.parseFloat(surfaceStyle.borderRightWidth),
        titleTopInset: titleRect.top - cardRects[0].top,
        titleLeftInset: titleRect.left - cardRects[0].left,
      };
    });

    await expect(inventoryForm).toBeVisible();
    await expect(visibleListings).toHaveCount(2);
    expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(Math.abs(layout.listWidth - layout.formWidth)).toBeLessThan(2);
    expect(Math.abs(layout.formWidth - layout.surfaceInnerWidth)).toBeLessThan(2);
    expect(layout.titleTopInset).toBeGreaterThanOrEqual(19);
    expect(layout.titleLeftInset).toBeGreaterThanOrEqual(19);

    if (viewport.width >= 2400) {
      expect(layout.gridColumns).toHaveLength(2);
      expect(Math.abs(layout.cards[0].top - layout.cards[1].top)).toBeLessThan(
        1
      );
      expect(layout.cards[1].left).toBeGreaterThan(layout.cards[0].right);
      expect(Math.abs(layout.cards[0].width - layout.cards[1].width)).toBeLessThan(
        1
      );
      expect(Math.abs(layout.cards[0].left - layout.listLeft)).toBeLessThan(1);
      expect(Math.abs(layout.cards[1].right - layout.listRight)).toBeLessThan(1);
    } else {
      expect(layout.gridColumns).toHaveLength(1);
      for (const card of layout.cards) {
        expect(Math.abs(card.left - layout.listLeft)).toBeLessThan(1);
        expect(Math.abs(card.right - layout.listRight)).toBeLessThan(1);
      }
    }
  }

  // Structured listings protect the Shop from deletion until Inventory is
  // explicitly cleared.
  await page
    .getByRole("navigation", { name: "Shop editor sections" })
    .getByRole("link", { name: "General", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete Shop", exact: true })
    .click();
  const protectedDeleteDialog = page.getByRole("dialog", {
    name: "Delete Shop",
  });
  await expect(
    protectedDeleteDialog.getByRole("button", {
      name: "Delete Permanently",
      exact: true,
    })
  ).toBeDisabled();
  await expect(
    page.getByText("Remove 2 inventory listings before deleting this shop.")
  ).toBeVisible();
  await protectedDeleteDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Shop editor sections" })
    .getByRole("link", { name: /Inventory/ })
    .click();

  // An exact third duplicate fails atomically and restores all typed rows.
  await page.getByRole("button", { name: "Add listing" }).click();
  rows = page.locator(".shop-inventory-row:visible");
  row = rows.nth(2);
  await selectAdminOption(
    row.getByRole("combobox", { name: "Item", exact: true }),
    fixtures.item.name
  );
  await selectAdminOption(
    row.getByRole("combobox", { name: "Currency", exact: true }),
    `${fixtures.primaryCurrency.name} (₽)`
  );
  await row.getByLabel("Price amount", { exact: true }).fill("1300");
  await page.getByRole("button", { name: /Save Inventory/ }).click();
  await expect(page.locator(".banner-error")).toContainText(
    "same Item and Currency combination"
  );
  // A server-side validation redirect is no longer treated as abandonment:
  // AdminFormGuard auto-restores the just-submitted draft and keeps the
  // form dirty, so no recovery prompt appears here any more.
  await expect(
    page.getByRole("button", { name: "Restore draft" })
  ).toHaveCount(0);
  rows = page.locator(".shop-inventory-row:visible");
  await expect(rows).toHaveCount(3);
  await rows
    .nth(2)
    .getByRole("button", { name: /Remove New listing/ })
    .click();
  await expect(rows.nth(2)).toContainText("Pending removal");

  // Verification intent applies only to the explicitly checked first row.
  await rows
    .nth(0)
    .getByRole("checkbox", { name: /Mark this listing as verified/ })
    .check();
  await page.getByRole("button", { name: /Save Inventory/ }).click();
  await expect(page.getByRole("status")).toHaveText("Shop inventory saved");
  rows = page.locator(".shop-inventory-row:visible");
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(rows.nth(0)).toContainText("Verified for");
  await expect(rows.nth(1)).toContainText("Unverified");

  // Existing rows are never deleted immediately: removal is visibly staged,
  // undoable, and only persists with the next save.
  const activeCardVisual = await rows.nth(0).evaluate((card) => {
    const rect = card.getBoundingClientRect();
    const style = getComputedStyle(card);
    return {
      x: rect.x,
      width: rect.width,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
    };
  });
  await rows
    .nth(0)
    .getByRole("button", { name: /Remove Test E2E Shop Item/ })
    .click();
  const removedRow = rows.nth(0);
  const undoRemoval = removedRow.getByRole("button", { name: "Undo removal" });
  await expect(removedRow).toContainText("Pending removal");
  await expect(removedRow).toHaveClass(/shop-inventory-row--removed/);
  await expect(undoRemoval).toBeVisible();
  await expect(undoRemoval).toBeEnabled();
  const removedCardVisual = await removedRow.evaluate((card) => {
    const rect = card.getBoundingClientRect();
    const style = getComputedStyle(card);
    const title = card.querySelector<HTMLElement>(".shop-inventory-row-title");
    const undo = Array.from(card.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Undo removal")
    );
    const removalState = card.querySelector<HTMLElement>(
      ".shop-inventory-removal-state"
    );
    if (!title || !undo || !removalState) {
      throw new Error("Pending-removal controls were not rendered.");
    }

    return {
      x: rect.x,
      width: rect.width,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      cardOpacity: style.opacity,
      titleOpacity: getComputedStyle(title).opacity,
      undoOpacity: getComputedStyle(undo).opacity,
      removalColor: getComputedStyle(removalState).color,
      dangerColor: getComputedStyle(document.documentElement)
        .getPropertyValue("--color-danger")
        .trim(),
    };
  });
  expect(removedCardVisual.backgroundColor).not.toBe(
    activeCardVisual.backgroundColor
  );
  expect(removedCardVisual.borderColor).not.toBe(activeCardVisual.borderColor);
  expect(Math.abs(removedCardVisual.x - activeCardVisual.x)).toBeLessThan(1);
  expect(Math.abs(removedCardVisual.width - activeCardVisual.width)).toBeLessThan(
    1
  );
  expect(removedCardVisual.cardOpacity).toBe("1");
  expect(Number.parseFloat(removedCardVisual.titleOpacity)).toBeLessThan(1);
  expect(removedCardVisual.undoOpacity).toBe("1");
  expect(removedCardVisual.removalColor).toBe("rgb(239, 68, 68)");
  expect(removedCardVisual.dangerColor).toBe("#ef4444");
  await undoRemoval.click();
  await expect(rows.nth(0)).not.toContainText("Pending removal");
  await rows
    .nth(0)
    .getByRole("button", { name: /Remove Test E2E Shop Item/ })
    .click();
  await page.getByRole("button", { name: /Save Inventory/ }).click();
  await expect(page.getByRole("status")).toHaveText("Shop inventory saved");
  await expect(page.locator(".shop-inventory-row:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();

  // Remove the final row, then the Shop becomes deletable again.
  row = page.locator(".shop-inventory-row:visible").first();
  await row
    .getByRole("button", { name: /Remove Test E2E Shop Item/ })
    .click();
  await page.getByRole("button", { name: /Save Inventory/ }).click();
  await expect(page.getByRole("status")).toHaveText("Shop inventory saved");
  await expect(page.locator(".shop-inventory-row:visible")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No inventory listings yet" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();

  await page
    .getByRole("navigation", { name: "Shop editor sections" })
    .getByRole("link", { name: "General", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete Shop", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Delete Shop" })
    .getByRole("button", { name: "Delete Permanently", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/shops");
});
