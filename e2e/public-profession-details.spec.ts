import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePublicProfessionDetailFixture,
  deleteE2ePublicProfessionDetailFixture,
  readE2ePublicProfessionDetailFixtureState,
} from "./helpers/database-cleanup";
import { readValidatedProfessionSpriteBytes } from "./helpers/profession-sprite-fixtures";

const SPRITE_DIRECTORY = path.join(
  __dirname,
  "fixtures",
  "profession-sprites"
);
const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "resource-responsibility-visuals"
);
const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "3440x1440", width: 3440, height: 1440 },
  { name: "intermediate-1000x1100", width: 1000, height: 1100 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

let fixture: Awaited<
  ReturnType<typeof createE2ePublicProfessionDetailFixture>
>;
let pageErrors: string[] = [];

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });
  const sprites = readValidatedProfessionSpriteBytes(SPRITE_DIRECTORY);
  fixture = await createE2ePublicProfessionDetailFixture(
    sprites.kilnkeeperCrucible,
    sprites
  );
});

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

test.afterAll(async () => {
  await deleteE2ePublicProfessionDetailFixture();
  expect(await readE2ePublicProfessionDetailFixtureState()).toEqual({
    professions: 0,
    recipes: 0,
    recipeIngredients: 0,
    items: 0,
    storageObjects: 0,
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    )
    .toBe(true);
}

test("Profession detail explains the discipline with a three-Recipe preview", async ({
  page,
}) => {
  const professionPath = `/professions/${fixture.profession.slug}`;

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(professionPath);
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: fixture.profession.name,
        exact: true,
      })
    ).toBeVisible();
    await expect(page.locator(".profession-recipe-preview-row")).toHaveCount(3);
    await expect(page.locator(".recipe-output-card")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: /pagination/i })
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `profession-preview-${viewport.name}.png`
      ),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(professionPath);
  const previewRows = page.locator(".profession-recipe-preview-row");
  await expect(previewRows).toHaveCount(3);
  await expect(previewRows.locator("img")).toHaveCount(3);
  await expect(previewRows.locator("img").first()).toHaveCSS(
    "image-rendering",
    "pixelated"
  );
  await expect(
    page.getByRole("link", {
      name: `Browse all ${fixture.profession.name} recipes`,
      exact: true,
    })
  ).toHaveAttribute(
    "href",
    `/recipes?profession=${fixture.profession.slug}`
  );
  await expect(
    page.locator(".profession-hero-counts").getByText("13", { exact: true })
  ).toHaveCount(2);
  await expect(
    previewRows.first()
  ).toHaveAttribute("href", `/recipes/${fixture.recipes[0].slug}`);
  await expect(previewRows.first()).toHaveAttribute(
    "aria-label",
    `${fixture.recipes[0].name}, produces ×${fixture.recipes[0].resultQuantityMin}–${fixture.recipes[0].resultQuantityMax} ${fixture.recipes[0].result.name}, category ${fixture.outputCategory.name}`
  );
  await previewRows.first().focus();
  await expect(previewRows.first()).toBeFocused();
  await expect(previewRows.first()).not.toHaveCSS("outline-style", "none");
});

test("zero-Recipe Profession hides its optional preview", async ({ page }) => {
  for (const viewport of [
    { name: "1920x1080", width: 1920, height: 1080 },
    { name: "mobile-390x844", width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/professions/foraging");
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Foraging",
        exact: true,
      })
    ).toBeVisible();
    const counts = page.locator(".profession-hero-counts");
    await expect(counts.getByText("0", { exact: true })).toHaveCount(2);
    await expect(page.locator(".profession-recipe-preview")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Browse all .* recipes/ })
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `profession-zero-recipes-${viewport.name}.png`
      ),
      fullPage: true,
    });
  }
});
