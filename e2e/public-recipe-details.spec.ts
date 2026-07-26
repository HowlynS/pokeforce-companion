import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createE2ePublicRecipeDetailFixture,
  deleteE2ePublicRecipeDetailFixture,
} from "./helpers/database-cleanup";

const PNG_FIXTURE = path.join(__dirname, "fixtures", "tiny-valid.png");
const SCREENSHOT_DIRECTORY = path.join(
  process.cwd(),
  "test-results",
  "recipe-detail-visuals"
);

let fixture: Awaited<ReturnType<typeof createE2ePublicRecipeDetailFixture>>;
let pageErrors: string[] = [];

test.beforeAll(async () => {
  fs.mkdirSync(SCREENSHOT_DIRECTORY, { recursive: true });
  fixture = await createE2ePublicRecipeDetailFixture(
    fs.readFileSync(PNG_FIXTURE)
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
  await deleteE2ePublicRecipeDetailFixture();
});

test("populated Recipe uses the shared detail composition and real relationships", async ({
  page,
}) => {
  await page.goto(`/recipes/${fixture.recipe.slug}`);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: fixture.recipe.name,
      exact: true,
    })
  ).toBeVisible();

  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(
    breadcrumb.getByRole("link", { name: "Home", exact: true })
  ).toHaveAttribute("href", "/");
  await expect(
    breadcrumb.getByRole("link", { name: "Recipes", exact: true })
  ).toHaveAttribute("href", "/recipes");
  await expect(
    breadcrumb.getByText(fixture.recipe.name, { exact: true })
  ).toHaveAttribute("aria-current", "page");

  await expect(page.getByText("Smithing", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("× 2–4", { exact: true })).toBeVisible();

  const heroImage = page.getByRole("img", {
    name: `Image of ${fixture.recipe.name}`,
    exact: true,
  });
  await expect(heroImage).toHaveCount(1);
  await expect(heroImage).toHaveCSS("image-rendering", "pixelated");
  await expect(page.locator(".public-sprite-stage--hero")).toHaveCount(1);

  const atmosphere = page.locator(".resource-atmosphere--recipe");
  expect(
    await atmosphere.evaluate(
      (element) => getComputedStyle(element, "::before").backgroundImage
    )
  ).toContain("radial-gradient");
  await expect(page.locator(".resource-atmosphere--item")).toHaveCount(0);
  await atmosphere.evaluate((element) => {
    (element as HTMLElement).style.setProperty(
      "--resource-atmosphere-image",
      "none"
    );
  });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: fixture.recipe.name,
      exact: true,
    })
  ).toBeVisible();
  await atmosphere.evaluate((element) => {
    (element as HTMLElement).style.removeProperty(
      "--resource-atmosphere-image"
    );
  });

  await expect(
    page.getByRole("heading", { level: 2, name: "Ingredients", exact: true })
  ).toBeVisible();
  const ingredientRows = page.locator(".recipe-ingredient-row");
  await expect(ingredientRows).toHaveCount(4);
  await expect(ingredientRows.first()).toHaveJSProperty("tagName", "A");
  await expect(
    ingredientRows.first().locator(".item-recipe-affordance")
  ).toHaveAttribute("aria-hidden", "true");
  const picturedIngredient = ingredientRows.filter({
    hasText: fixture.picturedIngredientName,
  });
  await expect(picturedIngredient).toHaveAttribute(
    "href",
    "/items/test-e2e-public-item-detail"
  );
  await expect(picturedIngredient).toContainText("× 2");
  await expect(
    picturedIngredient.getByRole("img", {
      name: `Image of ${fixture.picturedIngredientName}`,
    })
  ).toHaveCSS("image-rendering", "pixelated");
  await picturedIngredient.focus();
  await expect(picturedIngredient).toBeFocused();
  await expect(picturedIngredient).not.toHaveCSS("outline-style", "none");

  const resultRow = page.locator(".recipe-result-row");
  await expect(resultRow).toHaveJSProperty("tagName", "A");
  await expect(resultRow).toHaveAttribute("href", `/items/${fixture.result.slug}`);
  await expect(resultRow).toContainText(fixture.result.name);
  await expect(resultRow).toContainText("Produces × 2–4");
  await expect(resultRow.locator(".public-sprite-stage")).toHaveCount(0);
  await expect(
    resultRow.getByRole("img", {
      name: `Image of ${fixture.result.name}`,
      exact: true,
    })
  ).toHaveCount(0);
  await expect(resultRow.locator(".item-recipe-affordance")).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  await resultRow.focus();
  await expect(resultRow).toBeFocused();
  await expect(resultRow).not.toHaveCSS("outline-style", "none");

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Recipe details",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Verification",
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByText("Quick Links", { exact: true })).toHaveCount(0);
  for (const speculative of [
    "Required level",
    "Crafting time",
    "Success chance",
    "Energy cost",
    "Recipe price",
  ]) {
    await expect(page.getByText(speculative, { exact: false })).toHaveCount(0);
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3440, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIRECTORY,
        `recipe-populated-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-several-ingredients-1920x1080.png"
    ),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    )
  ).toBe(false);
  await page.screenshot({
    path: path.join(
      SCREENSHOT_DIRECTORY,
      "recipe-populated-mobile-390x844.png"
    ),
    fullPage: true,
  });
});

test("sparse and no-image Recipes preserve hide-empty behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes/charcoal");
  await expect(
    page.getByRole("heading", { level: 1, name: "Charcoal", exact: true })
  ).toBeVisible();
  await expect(
    page.locator(".item-sidebar-panel").getByText("Profession", { exact: true })
  ).toHaveCount(0);
  await expect(page.locator(".public-sprite-stage--hero")).toContainText(
    "No image available"
  );
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipe-sparse-1920x1080.png"),
    fullPage: true,
  });

  await page.goto("/recipes/iron-sword");
  await expect(page.locator(".public-sprite-stage--hero")).toContainText(
    "No image available"
  );
  await expect(page.getByRole("img", { name: "Image of Iron Sword" })).toHaveCount(
    0
  );
  await page.screenshot({
    path: path.join(SCREENSHOT_DIRECTORY, "recipe-no-image-1920x1080.png"),
    fullPage: true,
  });
});
