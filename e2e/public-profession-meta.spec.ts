// The ONE Profession-meta treatment.
//
// A Profession NAME rendered as secondary metadata is gold, uppercase and
// letter-spaced, everywhere it appears. This spec is the guard on that,
// across every surface that shows one.
//
// It exists because four Recipe card variants each carried a private copy of
// those four declarations, keyed on `> span:first-child` — and two of them
// were then followed by a `> span:last-child` rule recolouring the value dim
// grey. On a Recipe with a Profession but NO required level the Profession
// span is BOTH first and last child, so it lost its gold: the same Recipe
// directory Grid showed some professions gold and others muted, purely
// because of how many siblings a card happened to render.
//
// So the assertions are about the SHARED SEMANTIC CLASS and about sibling
// independence, not about a literal hex on each of a dozen selectors. The
// one colour comparison made is against the live --color-accent token, so a
// palette change moves the whole system together instead of failing here.

import { expect, test } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

const SHARED_CLASS = "public-meta-profession";

type MetaSurface = {
  name: string;
  route: string;
  /** Reveals the surface, where it is behind a view switch. */
  prepare?: (page: import("@playwright/test").Page) => Promise<void>;
  /** The card family the Profession meta must appear inside. */
  scope: string;
};

async function selectView(
  page: import("@playwright/test").Page,
  label: RegExp
) {
  const control = page.getByRole("button", { name: label }).first();
  if ((await control.count()) > 0) {
    await control.click();
  }
}

const SURFACES: MetaSurface[] = [
  {
    name: "Recipe directory Grid",
    route: "/recipes",
    scope: ".recipe-output-card--directory-grid",
  },
  {
    name: "Recipe directory List",
    route: "/recipes",
    prepare: (page) => selectView(page, /list/i),
    scope: ".recipe-output-card--directory-list",
  },
  {
    name: "compact Recipe Grid (Profession detail)",
    route: "/professions/smithing",
    scope: ".recipe-output-card--grid",
  },
  {
    name: "compact Recipe List (Profession detail)",
    route: "/professions/smithing",
    prepare: (page) => selectView(page, /list/i),
    scope: ".recipe-output-card--list",
  },
  {
    name: "compact Recipe Grid (Recipe detail, Related Recipes)",
    route: "/recipes/iron-sword",
    scope: ".recipe-output-card--grid",
  },
  {
    name: "compact Recipe Grid (Item detail, Used in recipes)",
    route: "/items/iron-ore",
    scope: ".recipe-output-card--grid",
  },
];

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

async function readMeta(
  page: import("@playwright/test").Page,
  scope: string,
  sharedClass: string
) {
  return page.evaluate(
    ({ scope: selector, sharedClass: shared }) => {
      const cards = Array.from(document.querySelectorAll(selector));
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim();

      const values = cards
        .map((card) => card.querySelector<HTMLElement>(`.${shared}`))
        .filter((element): element is HTMLElement => element !== null)
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            text: (element.textContent ?? "").trim(),
            color: style.color,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing,
            textTransform: style.textTransform,
            fontSize: Number.parseFloat(style.fontSize),
            // Whether this value is an only child, which is the exact shape
            // the old positional selectors mis-coloured.
            isOnlyChild: element.parentElement?.children.length === 1,
          };
        });

      return { cardCount: cards.length, values, accent };
    },
    { scope, sharedClass }
  );
}

/** "rgb(195, 154, 75)" for "#c39a4b". */
function hexToRgbString(hex: string) {
  const value = hex.replace("#", "");
  const parts = [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16)
  );
  return `rgb(${parts.join(", ")})`;
}

test("every Recipe surface renders its Profession through the shared class", async ({
  page,
}) => {
  for (const width of [1920, 3440]) {
    await page.setViewportSize({ width, height: 1080 });

    for (const surface of SURFACES) {
      const response = await page.goto(surface.route, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${surface.name} must render`).toBe(200);
      await surface.prepare?.(page);
      await page.locator(surface.scope).first().waitFor();

      const reading = await readMeta(page, surface.scope, SHARED_CLASS);
      const label = `${surface.name} @${width}`;

      expect(reading.cardCount, `${label}: cards render`).toBeGreaterThan(0);
      expect(
        reading.values.length,
        `${label}: Profession metadata uses .${SHARED_CLASS}`
      ).toBeGreaterThan(0);

      const expectedColor = hexToRgbString(reading.accent);
      for (const value of reading.values) {
        const valueLabel = `${label} "${value.text}"`;
        expect(value.color, `${valueLabel}: the canonical accent`).toBe(
          expectedColor
        );
        expect(value.textTransform, `${valueLabel}: uppercase`).toBe(
          "uppercase"
        );
        expect(value.fontWeight, `${valueLabel}: weight`).toBe("600");
        expect(value.letterSpacing, `${valueLabel}: tracking`).not.toBe(
          "normal"
        );
      }
    }
  }
});

test("a Profession with no required level beside it keeps its gold", async ({
  page,
}) => {
  // The precise drift: the old rules coloured the LAST span dim grey, so a
  // Profession with no level sibling was recoloured by the rule meant for
  // the level. Removing the sibling live proves the treatment no longer
  // depends on how many children the cell renders.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes", { waitUntil: "domcontentloaded" });
  await page.locator(".recipe-output-card--directory-grid").first().waitFor();

  const colors = await page.evaluate((shared) => {
    const cell = document.querySelector<HTMLElement>(
      `.recipe-output-card--directory-grid .recipe-output-requirement`
    )!;
    const value = cell.querySelector<HTMLElement>(`.${shared}`)!;
    const withSiblings = getComputedStyle(value).color;

    const removed = Array.from(cell.children).filter(
      (child) => child !== value
    );
    for (const child of removed) child.remove();
    const alone = getComputedStyle(value).color;

    return { withSiblings, alone, onlyChild: cell.children.length === 1 };
  }, SHARED_CLASS);

  expect(colors.onlyChild, "the sibling was actually removed").toBe(true);
  expect(
    colors.alone,
    "an only-child Profession keeps the same treatment as one with a level"
  ).toBe(colors.withSiblings);
});

test("the Recipe hero's Profession value uses the same treatment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes/iron-sword", { waitUntil: "domcontentloaded" });

  const hero = await page.evaluate((shared) => {
    const value = document.querySelector<HTMLElement>(
      `.recipe-info-chips .${shared}`
    );
    if (!value) return null;
    const style = getComputedStyle(value);
    return {
      text: (value.textContent ?? "").trim(),
      color: style.color,
      textTransform: style.textTransform,
      accent: getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim(),
      // Chip shape and typography hierarchy are untouched by this pass.
      chipBorder: getComputedStyle(value.closest(".item-info-chip")!)
        .borderTopWidth,
      chipRadius: getComputedStyle(value.closest(".item-info-chip")!)
        .borderTopLeftRadius,
    };
  }, SHARED_CLASS);

  expect(hero, "the Recipe hero names its Profession").not.toBeNull();
  expect(hero!.color, "the hero value takes the canonical accent").toBe(
    hexToRgbString(hero!.accent)
  );
  expect(hero!.textTransform, "uppercase, like every other surface").toBe(
    "uppercase"
  );
  expect(hero!.chipBorder, "the chip keeps its border").not.toBe("0px");
  expect(hero!.chipRadius, "the chip keeps its shape").not.toBe("0px");
});

test("compact Recipe metadata stays clearly secondary to the card title", async ({
  page,
}) => {
  // The compact cards' Profession/level used to ramp with --pf while the
  // title did not, so at 3440 the metadata rendered as large as the name it
  // sits under.
  for (const width of [1920, 2560, 3440]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/professions/smithing", { waitUntil: "domcontentloaded" });
    await page.locator(".recipe-output-card--grid").first().waitFor();

    const sizes = await page.evaluate((shared) => {
      const card = document.querySelector<HTMLElement>(
        ".recipe-output-card--grid"
      )!;
      const title = card.querySelector<HTMLElement>(
        ".recipe-output-recipe-link"
      )!;
      const profession = card.querySelector<HTMLElement>(`.${shared}`);
      const level = card.querySelector<HTMLElement>(
        ".recipe-output-requirement-level"
      );
      const size = (element: HTMLElement | null) =>
        element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
      return {
        title: size(title),
        profession: size(profession),
        level: size(level),
      };
    }, SHARED_CLASS);

    const label = `compact grid @${width}`;
    expect(sizes.title, `${label}: has a title`).not.toBeNull();
    if (sizes.profession !== null) {
      expect(
        sizes.profession,
        `${label}: Profession stays under the title`
      ).toBeLessThan(sizes.title!);
      // Readable, never hair-thin.
      expect(sizes.profession, `${label}: still legible`).toBeGreaterThanOrEqual(
        10
      );
      // Fixed, so it cannot ramp back past the title at ultrawide.
      expect(sizes.profession, `${label}: fixed, not ramped`).toBeCloseTo(
        10.5,
        1
      );
    }
    if (sizes.level !== null) {
      expect(sizes.level, `${label}: level stays under the title`).toBeLessThan(
        sizes.title!
      );
      expect(sizes.level, `${label}: fixed, not ramped`).toBeCloseTo(11, 1);
    }
  }
});
