// Browser coverage for the Admin Shell Background and Workspace
// Proportions pass, revised by the Wallpaper Correction pass, against the
// REAL application. This suite does NOT re-prove ground already covered
// exhaustively elsewhere (record-row visuals, editor-form visuals,
// context-panel contents, sticky record-list mechanics under
// viewport-height pressure — see admin-record-list-refinement.spec.ts and
// admin-visual-consistency.spec.ts). It targets only what these passes
// changed: the scenic background scoped to the admin shell as OUTER
// framing only, the opaque central application shell
// (.admin-content-inner) that keeps the artwork out of ordinary workspace
// gaps, and the three-column workspace's responsive widths. No screenshot
// or pixel-diff infrastructure, and no assertion on the image's actual
// rendered pixels — every check is a computed style, bounding box, or
// HTTP response against the real dev server.

import { expect, test, type Page } from "@playwright/test";

const BACKGROUND_URL = "/images/admin/admin-shell-background.webp";

// Browser error hygiene: any uncaught page error fails the test. Serial
// single-worker execution makes this module-level state safe.
let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

function shell(page: Page) {
  return page.locator(".admin-shell");
}

function contentInner(page: Page) {
  return page.locator(".admin-content-inner");
}

async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function columnWidths(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect();
    return {
      contentInner: rect(".admin-content-inner"),
      recordList: rect(".admin-workspace-record-list"),
      main: rect(".admin-workspace-main"),
      aside: rect(".admin-workspace-aside"),
    };
  });
}

// A plain "rgb(r, g, b)" (3 components) carries no alpha channel at all,
// i.e. fully opaque. Only "rgba(r, g, b, a)" (4 components) has an alpha
// to check — that 4th value must be exactly 1 (never partially see-through).
function expectOpaqueColor(color: string): void {
  const components = color.match(/[\d.]+/g) ?? [];
  if (components.length === 4) {
    expect(Number(components[3])).toBe(1);
  } else {
    expect(components.length).toBe(3);
  }
}

test("the scenic background is applied to the admin shell and resolves as a real asset", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/items/iron-ore/edit");

  const backgroundImage = await shell(page).evaluate(
    (el) => getComputedStyle(el).backgroundImage
  );
  expect(backgroundImage).toContain(BACKGROUND_URL);

  const response = await page.request.get(BACKGROUND_URL);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/webp");
});

test("the background never appears on a public page or the shell element itself never renders outside admin", async ({
  page,
}) => {
  for (const publicPath of ["/", "/items/iron-ore", "/login"]) {
    await page.goto(publicPath);
    // The class this entire background is scoped to must not exist at all
    // on a public route — the strongest possible proof of no leakage.
    await expect(page.locator(".admin-shell")).toHaveCount(0);

    const bodyBackground = await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBackground).not.toContain("admin-shell-background");
  }
});

test("the shell fills the viewport with no horizontal document overflow, at every target width", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  for (const width of [1440, 1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 900 });
    const shellBox = await shell(page).evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      minHeight: parseFloat(getComputedStyle(el).minHeight || "0"),
    }));
    expect(shellBox.width).toBeGreaterThanOrEqual(width - 1);
    await noHorizontalOverflow(page);
  }
});

test("the workspace grows between 1920 and 2560/3440 without exceeding a deliberate maximum", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  await page.setViewportSize({ width: 1920, height: 900 });
  const at1920 = await columnWidths(page);

  await page.setViewportSize({ width: 2560, height: 900 });
  const at2560 = await columnWidths(page);

  await page.setViewportSize({ width: 3440, height: 900 });
  const at3440 = await columnWidths(page);

  expect(at1920.contentInner).not.toBeNull();
  expect(at2560.contentInner!.width).toBeGreaterThan(at1920.contentInner!.width);
  // The workspace has a deliberate ceiling — it does not keep growing
  // forever on an ultrawide display; 3440 uses (at most) the same content
  // width as 2560, not more.
  expect(at3440.contentInner!.width).toBeLessThanOrEqual(at2560.contentInner!.width + 1);
  // But the workspace is still visibly wider than the pre-pass baseline
  // (1200px) at both wider breakpoints.
  expect(at2560.contentInner!.width).toBeGreaterThan(1200);
  expect(at3440.contentInner!.width).toBeGreaterThan(1200);
});

test("record-list and context-rail widths stay within their intended ranges, and the editor remains the largest column, across every target width", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  for (const width of [1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 900 });
    const widths = await columnWidths(page);
    expect(widths.recordList).not.toBeNull();
    expect(widths.aside).not.toBeNull();
    expect(widths.main).not.toBeNull();

    expect(widths.recordList!.width).toBeGreaterThanOrEqual(260);
    expect(widths.recordList!.width).toBeLessThanOrEqual(340);
    expect(widths.aside!.width).toBeGreaterThanOrEqual(280);
    expect(widths.aside!.width).toBeLessThanOrEqual(320);

    // The editor is always the dominant column — wider than either fixed
    // side column on its own.
    expect(widths.main!.width).toBeGreaterThan(widths.recordList!.width);
    expect(widths.main!.width).toBeGreaterThan(widths.aside!.width);

    // No overlap: the three columns sit left-to-right with the shared gap
    // between each, never covering one another.
    expect(widths.main!.left).toBeGreaterThanOrEqual(widths.recordList!.right);
    expect(widths.aside!.left).toBeGreaterThanOrEqual(widths.main!.right);
  }
});

test("all three columns fit at 1920 with no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/admin/items/iron-ore/edit");

  const widths = await columnWidths(page);
  expect(widths.aside!.right).toBeLessThanOrEqual(1920);
  await noHorizontalOverflow(page);
});

test("more edge area outside the workspace is available for scenery at 3440 than at 1920", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  await page.setViewportSize({ width: 1920, height: 900 });
  const edge1920 = await page.evaluate(
    () => window.innerWidth - (document.querySelector(".admin-content-inner")?.getBoundingClientRect().width ?? 0)
  );

  await page.setViewportSize({ width: 3440, height: 900 });
  const edge3440 = await page.evaluate(
    () => window.innerWidth - (document.querySelector(".admin-content-inner")?.getBoundingClientRect().width ?? 0)
  );

  expect(edge3440).toBeGreaterThan(edge1920);
});

test("the editor surface and context panels stay fully opaque over the scenic background", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/items/iron-ore/edit");

  const surfaceColor = await page
    .locator(".admin-editor-surface")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const panelColor = await page
    .locator(".admin-panel")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  expectOpaqueColor(surfaceColor);
  expectOpaqueColor(panelColor);
});

test("the central content-inner shell itself is opaque and does not render the scenic image — the artwork stays on the outer .admin-shell only", async ({
  page,
}) => {
  await page.goto("/admin");

  const inner = await contentInner(page).evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    };
  });
  expectOpaqueColor(inner.backgroundColor);
  // The central shell paints a flat color only — the artwork itself
  // belongs to .admin-shell behind it, never duplicated here.
  expect(inner.backgroundImage).toBe("none");

  const shellBackgroundImage = await shell(page).evaluate(
    (el) => getComputedStyle(el).backgroundImage
  );
  expect(shellBackgroundImage).toContain(BACKGROUND_URL);
});

test("Dashboard: the gaps between summary cards and the empty space below Quick Actions sit inside the opaque central shell, not on exposed scenery", async ({
  page,
}) => {
  await page.goto("/admin");

  // Every piece of real Dashboard content must be physically contained
  // within .admin-content-inner's own box — proving the gaps around and
  // below it (page header, space between cards, everything below Quick
  // Actions) are painted by that box's own opaque background, not by
  // whatever sits behind it on .admin-shell.
  const inner = await contentInner(page).boundingBox();
  const quickActions = await page
    .getByRole("heading", { name: "Quick Actions", exact: true })
    .boundingBox();
  const createItemLink = await page
    .getByRole("link", { name: "Create Item", exact: true })
    .boundingBox();
  expect(inner).not.toBeNull();
  expect(quickActions).not.toBeNull();
  expect(createItemLink).not.toBeNull();

  for (const box of [quickActions!, createItemLink!]) {
    expect(box.x).toBeGreaterThanOrEqual(inner!.x);
    expect(box.y).toBeGreaterThanOrEqual(inner!.y);
    expect(box.x + box.width).toBeLessThanOrEqual(inner!.x + inner!.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(inner!.y + inner!.height + 1);
  }

  // The shell also reaches at least the full viewport height, so a short
  // Dashboard never leaves exposed scenery below its own content.
  const viewportHeight = page.viewportSize()!.height;
  expect(inner!.height).toBeGreaterThanOrEqual(viewportHeight - 1);
});

test("the central shell is narrower than the full viewport at ultrawide sizes, and the visible outer gutter widens as the viewport widens", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const gutterWidth = async (viewportWidth: number) => {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    const inner = await contentInner(page).boundingBox();
    expect(inner).not.toBeNull();
    // Narrower than the full viewport — the artwork has real room to
    // show either side of it.
    expect(inner!.width).toBeLessThan(viewportWidth);
    return viewportWidth - inner!.width;
  };

  const gutter1920 = await gutterWidth(1920);
  const gutter2560 = await gutterWidth(2560);
  const gutter3440 = await gutterWidth(3440);

  expect(gutter2560).toBeGreaterThan(gutter1920);
  expect(gutter3440).toBeGreaterThan(gutter2560);
});

test("sticky record list and sticky EditorActions both keep working over the new background", async ({
  page,
}) => {
  // Short viewport forces both sticky elements to actually engage.
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.goto("/admin/items/iron-ore/edit");

  const recordListPosition = await page
    .locator(".admin-record-list")
    .evaluate((el) => getComputedStyle(el).position);
  expect(recordListPosition).toBe("sticky");

  const actionsPosition = await page
    .locator(".admin-editor-actions")
    .evaluate((el) => getComputedStyle(el).position);
  expect(actionsPosition).toBe("sticky");

  // Scroll the page and confirm the record list stays pinned near the top
  // of the viewport rather than scrolling away with the page.
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect
    .poll(() =>
      page.locator(".admin-record-list").evaluate((el) => el.getBoundingClientRect().top)
    )
    .toBeLessThanOrEqual(25);

  const saveButton = page.getByRole("button", { name: "Save item", exact: true });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
});

test("a page without an aside (Recipe Ingredients) stays safe: no overflow, editor surface intact, no aside column rendered", async ({
  page,
}) => {
  // Seeded fixture only — read, never modified.
  await page.goto("/admin/recipes/iron-sword/ingredients");

  await expect(page.locator(".admin-workspace-aside")).toHaveCount(0);
  await expect(page.locator(".admin-editor-surface")).toBeVisible();
  await noHorizontalOverflow(page);

  await page.setViewportSize({ width: 3440, height: 1440 });
  await noHorizontalOverflow(page);
  await expect(page.locator(".admin-editor-surface")).toBeVisible();
});

test("decorative background layers never intercept pointer events — a click through the shell still reaches the intended control", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  // If any background/overlay layer were absorbing clicks, this would
  // time out or click the wrong element instead of toggling the checkbox.
  const heldItem = page.getByLabel("Held item", { exact: true });
  await expect(heldItem).not.toBeChecked();
  await heldItem.click();
  await expect(heldItem).toBeChecked();
});
