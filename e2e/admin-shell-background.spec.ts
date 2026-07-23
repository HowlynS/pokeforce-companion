// Browser coverage for the Admin Shell Background and Workspace
// Proportions pass, revised by the Wallpaper Correction pass and the Shell
// Composition Correction pass, against the REAL application. This suite
// does NOT re-prove ground already covered exhaustively elsewhere
// (record-row visuals, editor-form visuals, context-panel contents,
// sticky record-list mechanics under viewport-height pressure — see
// admin-record-list-refinement.spec.ts and admin-visual-consistency.spec.ts).
// It targets only what these passes changed: the scenic background scoped
// to the admin shell as OUTER framing only, the combined application frame
// (.admin-frame) that keeps sidebar and content directly adjacent with no
// scenic gap between them and owns the outer gutters, the opaque central
// application surface (.admin-content-inner) that keeps the artwork out of
// ordinary workspace gaps, and the three-column workspace's responsive
// widths. No screenshot or pixel-diff infrastructure, and no assertion on
// the image's actual rendered pixels — every check is a computed style,
// bounding box, or HTTP response against the real dev server.

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

function frame(page: Page) {
  return page.locator(".admin-frame");
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
      frame: rect(".admin-frame"),
      sidebar: rect(".admin-sidebar"),
      content: rect(".admin-content"),
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

test("the combined frame grows substantially between 1920 and 2560, and reaches its ceiling by 3440 within the approved ~2850-2950px target", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  await page.setViewportSize({ width: 1920, height: 900 });
  const at1920 = await columnWidths(page);

  await page.setViewportSize({ width: 2560, height: 900 });
  const at2560 = await columnWidths(page);

  await page.setViewportSize({ width: 3440, height: 900 });
  const at3440 = await columnWidths(page);

  expect(at1920.frame).not.toBeNull();
  // Substantial growth from 1920 to 2560 — the frame is still climbing
  // toward its ceiling here, not already capped.
  expect(at2560.frame!.width).toBeGreaterThan(at1920.frame!.width + 300);
  // The frame still grows a bit further from 2560 to 3440 (it only meets
  // its ceiling at the widest target). Admin Visual/UX Correction pass
  // (Part 2): the ceiling was LOWERED from ~3150px to ~2900px — measured
  // live to visibly double the scenic gutter at 3440px (roughly 145px per
  // side -> roughly 270px per side) while the editor/record/context
  // columns still meaningfully dominate the reduced frame, rather than
  // the interface reading as miniaturized against the full ultrawide
  // viewport.
  expect(at3440.frame!.width).toBeGreaterThan(at2560.frame!.width);
  expect(at3440.frame!.width).toBeGreaterThanOrEqual(2850);
  expect(at3440.frame!.width).toBeLessThanOrEqual(2950);

  // The frame is substantially wider than the pre-frame-correction
  // content-only shell (1650px) ever reached, at both wider breakpoints.
  expect(at2560.frame!.width).toBeGreaterThan(1650);
  expect(at3440.frame!.width).toBeGreaterThan(1650);
});

test("record-list and context-rail widths stay within their intended ranges, and the editor remains the largest column, across every target width", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  for (const width of [1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 900 });
    // Polled rather than a one-shot read: a freshly resized dev-mode page
    // can briefly report a stale/transitional aside width (still settling
    // from the previous viewport's flex layout) before it stabilizes —
    // the same class of timing gap already documented and handled this
    // way elsewhere in this suite (see admin-editor-surface.spec.ts).
    await expect
      .poll(async () => (await columnWidths(page)).aside?.width)
      .toBeLessThanOrEqual(300);
    const widths = await columnWidths(page);
    expect(widths.recordList).not.toBeNull();
    expect(widths.aside).not.toBeNull();
    expect(widths.main).not.toBeNull();

    // Admin Visual/UX Correction pass (Part 3): both ranges trimmed
    // (record-list 260-340 -> 240-300, aside 280-320 -> 260-300) to give
    // the main editor column more of the frame's own width.
    expect(widths.recordList!.width).toBeGreaterThanOrEqual(240);
    expect(widths.recordList!.width).toBeLessThanOrEqual(300);
    expect(widths.aside!.width).toBeGreaterThanOrEqual(260);
    expect(widths.aside!.width).toBeLessThanOrEqual(300);

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

test("more edge area outside the combined frame is available for scenery at 3440 than at 1920", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  await page.setViewportSize({ width: 1920, height: 900 });
  const edge1920 = await page.evaluate(
    () => window.innerWidth - (document.querySelector(".admin-frame")?.getBoundingClientRect().width ?? 0)
  );

  await page.setViewportSize({ width: 3440, height: 900 });
  const edge3440 = await page.evaluate(
    () => window.innerWidth - (document.querySelector(".admin-frame")?.getBoundingClientRect().width ?? 0)
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

test("the sidebar and admin content sit directly adjacent with zero gap between them, and both live inside one shared .admin-frame", async ({
  page,
}) => {
  // Root-cause regression guard for the detached-sidebar bug: the sidebar
  // used to be a direct .admin-shell child, so it sat flush at the true
  // viewport edge while .admin-content-inner centered ITSELF independently
  // in the narrower remainder beside it, opening a scenic gap between the
  // two. Checked at every target width, not just one, since the old bug
  // only appeared once the viewport was wide enough for that independent
  // centering to drift.
  for (const width of [1440, 1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin");

    const widths = await columnWidths(page);
    expect(widths.sidebar).not.toBeNull();
    expect(widths.content).not.toBeNull();
    expect(widths.content!.x - widths.sidebar!.right).toBe(0);

    // Both are DOM descendants of the same .admin-frame — not simply
    // adjacent by coincidence, but structurally grouped as one unit.
    const bothInsideOneFrame = await page.evaluate(() => {
      const frameEl = document.querySelector(".admin-frame");
      const sidebarEl = document.querySelector(".admin-sidebar");
      const contentEl = document.querySelector(".admin-content");
      return Boolean(
        frameEl && sidebarEl && contentEl &&
        frameEl.contains(sidebarEl) && frameEl.contains(contentEl)
      );
    });
    expect(bothInsideOneFrame).toBe(true);
  }
});

test("the combined frame is horizontally centered with approximately balanced left and right scenic gutters, at every target width", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  for (const width of [1440, 1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await frame(page).boundingBox();
    expect(box).not.toBeNull();

    const leftGutter = box!.x;
    const rightGutter = width - (box!.x + box!.width);
    // A tiny tolerance for the sub-pixel rounding a centered, fractional
    // clamp() value can produce — never a meaningfully lopsided frame.
    expect(Math.abs(leftGutter - rightGutter)).toBeLessThanOrEqual(1);
  }
});

test("Game Versions (no AdminWorkspace at all) still renders inside the same combined frame, with sidebar and content adjacent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 3440, height: 900 });
  await page.goto("/admin/settings/game-versions");

  const widths = await columnWidths(page);
  expect(widths.sidebar).not.toBeNull();
  expect(widths.content).not.toBeNull();
  expect(widths.content!.x - widths.sidebar!.right).toBe(0);
  await noHorizontalOverflow(page);
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

test("Dashboard: the gaps between resource modules and the empty space below the grid sit inside the opaque central shell, not on exposed scenery", async ({
  page,
}) => {
  await page.goto("/admin");

  // Every piece of real Dashboard content must be physically contained
  // within .admin-content-inner's own box — proving the gaps around and
  // below it (page header, space between modules, everything below the
  // grid) are painted by that box's own opaque background, not by
  // whatever sits behind it on .admin-shell. The former separate "Quick
  // Actions" section is gone (Visual Pass II Section 8) — each module's
  // own attached create action is checked here instead.
  const inner = await contentInner(page).boundingBox();
  const grid = await page.locator(".admin-dashboard-grid").boundingBox();
  const createItemLink = await page
    .getByRole("link", { name: "Create item", exact: true })
    .boundingBox();
  expect(inner).not.toBeNull();
  expect(grid).not.toBeNull();
  expect(createItemLink).not.toBeNull();

  for (const box of [grid!, createItemLink!]) {
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

test("the combined frame is narrower than the full viewport at ultrawide sizes, and the visible outer gutter widens as the viewport widens", async ({
  page,
}) => {
  await page.goto("/admin/items/iron-ore/edit");

  const gutterWidth = async (viewportWidth: number) => {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    const box = await frame(page).boundingBox();
    expect(box).not.toBeNull();
    // Narrower than the full viewport — the artwork has real room to
    // show either side of the WHOLE application (sidebar included).
    expect(box!.width).toBeLessThan(viewportWidth);
    return viewportWidth - box!.width;
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

  const saveButton = page.getByRole("button", { name: "Save Changes", exact: true });
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
