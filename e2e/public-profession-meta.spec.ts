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
import {
  createE2ePublicShopFixtures,
  deleteE2eTestShopRecords,
  createE2ePublicLocationDirectoryFixtures,
  deleteE2ePublicLocationDirectoryFixtures,
} from "./helpers/database-cleanup";
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

test.beforeAll(async () => {
  await createE2ePublicShopFixtures();
  await createE2ePublicLocationDirectoryFixtures();
});

test.afterAll(async () => {
  await deleteE2ePublicLocationDirectoryFixtures();
  await deleteE2eTestShopRecords();
});

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

test("the Recipe hero's Profession value is a linked chip value, not card meta", async ({
  page,
}) => {
  // The hero chip is a DIFFERENT tier from the cards. It carries
  // .public-meta-link -- the same gold, but the chip's own typography and
  // ordinary title casing: "Profession: Smithing", never
  // "Profession: SMITHING". It used to carry .public-meta-profession, whose
  // uppercase and letter-spacing made this one chip read wider and louder
  // than its Level and Reward neighbours.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes/iron-sword", { waitUntil: "domcontentloaded" });

  const hero = await page.evaluate(() => {
    const chip = document.querySelector<HTMLElement>(
      ".recipe-info-chips a.item-info-chip"
    );
    if (!chip) return null;
    const value = chip.querySelector<HTMLElement>(".public-meta-link");
    if (!value) return null;
    const valueStyle = getComputedStyle(value);
    const chipStyle = getComputedStyle(chip);

    // A plain, non-linked neighbour is the sizing reference.
    const plainChip = document.querySelector<HTMLElement>(
      ".recipe-info-chips span.item-info-chip"
    );
    const plainStyle = plainChip ? getComputedStyle(plainChip) : null;

    return {
      text: (value.textContent ?? "").trim(),
      color: valueStyle.color,
      textTransform: valueStyle.textTransform,
      letterSpacing: valueStyle.letterSpacing,
      fontSize: valueStyle.fontSize,
      // The card meta treatment must NOT be on this element.
      carriesCardMeta: value.classList.contains("public-meta-profession"),
      chipFontSize: chipStyle.fontSize,
      chipPadding: chipStyle.padding,
      chipHeight: Math.round(chip.getBoundingClientRect().height),
      chipBorderWidth: chipStyle.borderTopWidth,
      chipRadius: chipStyle.borderTopLeftRadius,
      plainChipFontSize: plainStyle?.fontSize ?? null,
      plainChipPadding: plainStyle?.padding ?? null,
      plainChipHeight: plainChip
        ? Math.round(plainChip.getBoundingClientRect().height)
        : null,
      accent: getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim(),
    };
  });

  expect(hero, "the Recipe hero names its Profession in a linked chip").not.toBeNull();

  // ---- Gold, because it navigates ------------------------------------
  expect(hero!.color, "the linked value takes the canonical accent").toBe(
    hexToRgbString(hero!.accent)
  );

  // ---- Ordinary chip typography, ordinary casing ----------------------
  expect(hero!.text, "title casing, not uppercase").toBe("Smithing");
  expect(hero!.textTransform, "no uppercase transform").toBe("none");
  expect(hero!.letterSpacing, "no card-meta tracking").toBe("normal");
  expect(hero!.carriesCardMeta, "not the card meta treatment").toBe(false);

  // ---- Sized and shaped exactly like its plain neighbours -------------
  expect(hero!.fontSize, "value matches the chip's own type size").toBe(
    hero!.chipFontSize
  );
  expect(hero!.chipFontSize, "same type size as a plain chip").toBe(
    hero!.plainChipFontSize
  );
  expect(hero!.chipPadding, "same padding as a plain chip").toBe(
    hero!.plainChipPadding
  );
  expect(hero!.chipHeight, "same height as a plain chip").toBe(
    hero!.plainChipHeight
  );
  expect(hero!.chipBorderWidth, "the chip keeps its border").not.toBe("0px");
  expect(hero!.chipRadius, "the chip keeps its shape").not.toBe("0px");
});

test("a linked hero chip shows exactly one ring on hover and on focus", async ({
  page,
}) => {
  // The double outline: a.item-info-chip painted a transparent 2px `outline`
  // at rest and turned it gold on hover ALONGSIDE the gold border, so hover
  // drew two concentric gold rings 2px apart. Hover now moves the border and
  // the glow only; the keyboard ring is the global a:focus-visible outline.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/recipes/iron-sword", { waitUntil: "domcontentloaded" });

  const chip = page.locator(".recipe-info-chips a.item-info-chip").first();
  await expect(chip).toBeVisible();

  const read = () =>
    chip.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        borderColor: style.borderTopColor,
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    });

  const rest = await read();
  expect(rest.outlineStyle, "no ring is painted at rest").toBe("none");

  await chip.hover();
  // The border transition is 165ms; settle it before reading.
  await page.waitForTimeout(300);
  const hovered = await read();

  expect(
    hovered.outlineStyle,
    "hover draws NO outline -- the border alone is the hover ring"
  ).toBe("none");
  expect(hovered.borderColor, "hover moves the border").not.toBe(
    rest.borderColor
  );
  expect(hovered.width, "hover never changes the chip's box").toBe(rest.width);
  expect(hovered.height, "hover never changes the chip's box").toBe(
    rest.height
  );

  // Keyboard focus keeps a clear, single ring: the global focus outline.
  await chip.focus();
  const focused = await chip.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focused.outlineStyle, "focus is still visibly ringed").not.toBe(
    "none"
  );
  expect(focused.outlineWidth, "and it is a real ring").not.toBe("0px");
});

test("hero chips gild the values that navigate, and only those", async ({
  page,
}) => {
  // The semantic rule, across every detail hero: a chip value that links to
  // another public page is gold; a plain scalar fact is full-strength text.
  // This replaced `.profession-detail-chip:last-child strong`, which gilded
  // whichever chip happened to come last -- on Location detail that was the
  // "Shops: 0" count, which links nowhere.
  await page.setViewportSize({ width: 1920, height: 1080 });

  const pages = [
    { name: "Profession", route: "/professions/smithing" },
    { name: "Class", route: "/classes/artisan" },
    {
      name: "Location",
      route: "/locations/test-e2e-location-public-directory-region",
    },
    { name: "Shop", route: "/shops/test-e2e-shop-public-alpha" },
    { name: "Recipe", route: "/recipes/iron-sword" },
  ] as const;

  for (const target of pages) {
    const response = await page.goto(target.route, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), `${target.name} must render`).toBe(200);

    const chips = await page.evaluate(() => {
      const container = document.querySelector(
        ".profession-detail-chips, .shop-detail-chips, .item-info-chips"
      );
      if (!container) return null;
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim();
      return {
        accent,
        rows: Array.from(container.children).map((child) => {
          const element = child as HTMLElement;
          const value = element.querySelector<HTMLElement>("strong");
          return {
            text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
            isLink: element.tagName === "A",
            carriesLinkedMeta: Boolean(
              value?.classList.contains("public-meta-link")
            ),
            // An explicitly accented value (EXP reward, sell value) is a
            // deliberate emphasis, not a navigational reference.
            carriesOwnAccent: Boolean(
              value?.classList.contains("item-info-chip-accent")
            ),
            valueColor: value ? getComputedStyle(value).color : null,
          };
        }),
      };
    });

    expect(chips, `${target.name}: renders hero chips`).not.toBeNull();
    const gold = hexToRgbString(chips!.accent);

    for (const row of chips!.rows) {
      const label = `${target.name} "${row.text}"`;
      if (row.isLink) {
        expect(
          row.carriesLinkedMeta,
          `${label}: a navigable chip value uses .public-meta-link`
        ).toBe(true);
        expect(row.valueColor, `${label}: and is therefore gold`).toBe(gold);
      } else if (!row.carriesOwnAccent && row.valueColor) {
        expect(
          row.carriesLinkedMeta,
          `${label}: a plain fact must not claim the linked treatment`
        ).toBe(false);
        expect(
          row.valueColor,
          `${label}: a plain fact stays full-strength text, not gold`
        ).not.toBe(gold);
      }
    }
  }
});

test("Profession and Class heroes say Type, never Resource", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const target of [
    { route: "/professions/smithing", value: "Profession", href: "/professions" },
    { route: "/classes/artisan", value: "Class", href: "/classes" },
  ]) {
    await page.goto(target.route, { waitUntil: "domcontentloaded" });

    const chip = page
      .locator(".profession-detail-chips > *")
      .filter({ hasText: "Type:" })
      .first();
    await expect(chip, `${target.route}: has a Type chip`).toBeVisible();
    await expect(chip, `${target.route}: names the resource`).toContainText(
      target.value
    );
    await expect(chip, `${target.route}: links to its directory`).toHaveAttribute(
      "href",
      target.href
    );

    // The old wording is gone from the whole hero.
    await expect(
      page.locator(".profession-detail-chips").getByText("Resource:", {
        exact: false,
      }),
      `${target.route}: no "Resource" wording remains`
    ).toHaveCount(0);
  }
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
