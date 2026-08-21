import { expect, test, type Page } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

// Anonymous public browsing only.
requireSiteVisibility("PUBLIC");

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

const FILTER_TRIGGER = ".directory-filter-trigger";
const FILTER_PANEL = ".directory-filter-panel";

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
    "the page must not scroll horizontally",
  ).toBe(true);
}

/**
 * The first Profession the Recipe directory itself offers as a filter option
 * — i.e. one that provably has at least one Recipe. Read from the live page
 * rather than hard-coded so this spec stays valid as the data changes.
 */
async function firstFilterableProfession(page: Page) {
  await page.goto("/recipes");
  await page.locator(FILTER_TRIGGER).click();
  const firstOption = page
    .locator(FILTER_PANEL)
    .locator('input[name="profession"]')
    .first();
  await expect(firstOption).toBeAttached();
  const slug = await firstOption.inputValue();
  const name = (await firstOption.locator("xpath=..").innerText()).trim();
  return { slug, name };
}

test("Filter popover animates open, stays mounted through its exit, and paints above the cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/items");

  const trigger = page.locator(FILTER_TRIGGER);
  const panel = page.locator(FILTER_PANEL);

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveCount(0);

  // Opening runs the entry animation rather than snapping into place.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toHaveCount(1);
  const openAnimation = await panel.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      name: style.animationName,
      duration: style.animationDuration,
      timing: style.animationTimingFunction,
      origin: style.transformOrigin,
      zIndex: style.zIndex,
      position: style.position,
    };
  });
  expect(openAnimation.name).toBe("cx-directory-filter-in");
  expect(openAnimation.duration).toBe("0.18s");
  expect(openAnimation.timing).toBe("cubic-bezier(0.2, 0.9, 0.3, 1)");
  expect(openAnimation.origin.startsWith("0px 0px")).toBe(true);
  // Absolutely positioned with a real stacking order — it overlays the cards
  // without reflowing them and without an arbitrary giant z-index.
  expect(openAnimation.position).toBe("absolute");
  expect(Number.parseInt(openAnimation.zIndex, 10)).toBe(40);
  await expectNoHorizontalOverflow(page);

  // The panel genuinely covers a directory card rather than clipping behind it.
  const panelBox = await panel.boundingBox();
  const cardBox = await page
    .locator(".item-catalogue-card")
    .first()
    .boundingBox();
  if (!panelBox || !cardBox) throw new Error("Expected panel and card geometry");
  expect(panelBox.y + panelBox.height).toBeGreaterThan(cardBox.y);
  const painted = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest(".directory-filter-panel") !==
      null,
    { x: panelBox.x + panelBox.width / 2, y: panelBox.y + 8 },
  );
  expect(painted, "the popover must paint above the directory cards").toBe(true);

  // Closing keeps the panel mounted while its exit plays.
  await page.locator("h1").click({ position: { x: 2, y: 2 } });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  const closing = page.locator(FILTER_PANEL + "--closing");
  await expect(closing).toHaveCount(1);
  const closeAnimation = await closing.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(closeAnimation.name).toBe("cx-directory-filter-out");
  expect(closeAnimation.duration).toBe("0.14s");

  // ...and then unmounts on its own.
  await expect(panel).toHaveCount(0);

  // Escape closes too, returning focus to the trigger, and repeated
  // open/close cycles keep working.
  await trigger.click();
  await expect(panel).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(panel).toHaveCount(1);
  await expect(page.locator(FILTER_PANEL + "--closing")).toHaveCount(0);
});

test("Filter popover opens and closes instantly under reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/items");

  const trigger = page.locator(FILTER_TRIGGER);
  const panel = page.locator(FILTER_PANEL);

  await trigger.click();
  await expect(panel).toHaveCount(1);
  // No entry animation is declared at all under reduced motion.
  expect(
    await panel.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");

  await page.keyboard.press("Escape");
  // The close handoff is zero, so the panel unmounts without an exit pass.
  await expect(panel).toHaveCount(0);
  // The filter is still fully usable.
  await trigger.click();
  await expect(panel.locator('input[type="checkbox"]').first()).toBeAttached();
  await context.close();
});

test("Profession detail's Recipes count deep-links into the Recipe directory's Profession filter", async ({
  page,
}) => {
  const profession = await firstFilterableProfession(page);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/professions/" + profession.slug);

  const recipesChip = page
    .locator(".profession-detail-chip")
    .filter({ hasText: "Recipes:" });
  await expect(recipesChip).toHaveCount(1);

  // A real anchor with a canonical, shareable destination — not a click
  // handler and not a bespoke route.
  const href = await recipesChip.getAttribute("href");
  expect(href).toBe("/recipes?profession=" + profession.slug);
  const count = (await recipesChip.innerText()).replace(/\D/g, "");
  await expect(recipesChip).toHaveAttribute(
    "aria-label",
    "View " + count + " " + profession.name + " recipes",
  );

  // It reads as interactive on hover/focus, unlike the inert fact chips.
  await recipesChip.focus();
  await expect(recipesChip).toBeFocused();
  await expect(recipesChip).not.toHaveCSS("outline-style", "none");
  await expect(recipesChip).toHaveCSS("cursor", "pointer");

  await recipesChip.click();
  await expect(page).toHaveURL("/recipes?profession=" + profession.slug);

  // The directory hydrates the filter from the URL: the trigger reports one
  // active filter and the popover shows this Profession checked.
  const trigger = page.locator(FILTER_TRIGGER);
  await expect(page.locator(".directory-filter-count")).toHaveText("1");
  await trigger.click();
  const checkbox = page
    .locator(FILTER_PANEL)
    .locator('input[name="profession"][value="' + profession.slug + '"]');
  await expect(checkbox).toBeChecked();
  await page.keyboard.press("Escape");

  // The result set is genuinely constrained to that Profession.
  const filteredCount = await page.locator(".recipe-output-card").count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(Number.parseInt(count, 10)).toBe(filteredCount);

  // The filter survives a reload.
  await page.reload();
  await expect(page).toHaveURL("/recipes?profession=" + profession.slug);
  await expect(page.locator(".directory-filter-count")).toHaveText("1");
  await expect(page.locator(".recipe-output-card")).toHaveCount(filteredCount);
});

test("live text search composes with a deep-linked Profession filter", async ({
  page,
}) => {
  const profession = await firstFilterableProfession(page);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes?profession=" + profession.slug);

  const cards = page.locator(".recipe-output-card");
  const filteredCount = await cards.count();
  expect(filteredCount).toBeGreaterThan(0);

  const searchField = page.getByRole("searchbox");
  await searchField.fill("zzzzzzzz");
  await expect(cards).toHaveCount(0);
  // The Profession filter is never dropped by a live search write.
  await expect(page).toHaveURL(
    new RegExp("profession=" + profession.slug),
  );
  await expect(page.locator(".directory-filter-count")).toHaveText("1");

  // Clearing the text restores the Profession-filtered set, not the whole
  // catalogue.
  await searchField.fill("");
  await expect(cards).toHaveCount(filteredCount);
  await expect(page.locator(".directory-filter-count")).toHaveText("1");
});

// Profession and Class list-view thumbnails are ONE shared implementation --
// now literally the same class, .directory-list-media, that every main
// directory List row uses (see public-directory-list-geometry.spec.ts for the
// geometry contract). This asserts the HUE contract for both resources rather
// than letting either drift: the frame always carries its own resource hue,
// whether or not the record has artwork, and the sprite stage inside it stays
// contained and centred.
test("Profession and Class List thumbnails keep their resource hue with no artwork", async ({
  page,
}) => {
  const resources = [
    {
      name: "Profession",
      path: "/professions",
      media: ".directory-list-media",
      token: "--hue-profession",
    },
    {
      name: "Class",
      path: "/classes",
      media: ".directory-list-media",
      token: "--hue-class",
    },
  ] as const;

  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const resource of resources) {
    await page.goto(resource.path);
    await page.getByRole("button", { name: "List", exact: true }).click();

    const media = page.locator(resource.media).first();
    await expect(media, resource.name).toBeVisible();

    const painted = await media.evaluate(
      (element, token) => {
        const style = getComputedStyle(element);
        const stage = element.querySelector(".public-sprite-stage");
        const stageBox = stage?.getBoundingClientRect();
        const mediaBox = element.getBoundingClientRect();
        return {
          hue: style.getPropertyValue("--resource-hue").trim(),
          canonical: getComputedStyle(document.documentElement)
            .getPropertyValue(token)
            .trim(),
          hasImage: Boolean(element.querySelector("img")),
          backgroundImage: style.backgroundImage,
          contained:
            !!stageBox &&
            stageBox.width <= mediaBox.width + 0.5 &&
            stageBox.height <= mediaBox.height + 0.5,
        };
      },
      resource.token,
    );

    // The seeded records carry no artwork, so this is the no-image path.
    expect(painted.hasImage, resource.name).toBe(false);
    expect(painted.canonical, resource.name).not.toBe("");
    // Resolved through the canonical token, never a colour literal...
    expect(painted.hue, resource.name).toBe(painted.canonical);
    // ...and actually painted, not merely declared.
    expect(painted.backgroundImage, resource.name).toContain("radial-gradient");
    expect(painted.contained, resource.name).toBe(true);
  }
});
