// The shared COMPACT relationship Recipe list.
//
// One implementation serves every "recipes related to this record" surface:
// Item -> Used in recipes, Recipe -> Related Recipes, Profession -> Recipes.
// This spec asserts the geometry they share, so a fix lands once rather than
// being page-patched three times.
//
// Deliberately NOT covered here: the main /recipes directory List (its own
// density standard lives in public-directory-list-geometry.spec.ts) and the
// compact GRID card, which is approved as-is and must stay unchanged — the
// last test in this file is the guard for exactly that.

import { expect, test } from "@playwright/test";
import { requireSiteVisibility } from "./helpers/site-visibility";

requireSiteVisibility("PUBLIC");

/** Every surface that renders the shared compact list. */
const CONSUMERS = [
  { name: "Profession Recipes", route: "/professions/smithing" },
  { name: "Item Used in recipes", route: "/items/iron-ingot" },
  { name: "Recipe Related Recipes", route: "/recipes/iron-sword" },
] as const;

const WIDTHS = [1920, 3440] as const;

let pageErrors: string[] = [];

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, "no uncaught page errors are allowed").toEqual([]);
});

/**
 * Switches a catalogue into List view. `rowSelector` differs by surface: the
 * main /recipes directory renders --directory-list rows, every relationship
 * surface renders the compact --list rows this spec is about.
 */
async function openList(
  page: import("@playwright/test").Page,
  route: string,
  rowSelector = ".recipe-output-card--list"
) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // View mode is client state, so a click landing before hydration is a
  // silent no-op. Retry until the toggle actually reports the new mode.
  const toggle = page.getByRole("button", { name: "List", exact: true }).first();
  await expect(async () => {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  }).toPass({ timeout: 15_000 });
  await expect(page.locator(rowSelector).first()).toBeVisible();
}

for (const width of WIDTHS) {
  test(`ingredient quantity badges are never clipped at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });

    for (const consumer of CONSUMERS) {
      await openList(page, consumer.route);

      const rows = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".recipe-output-card--list")
        ).map((row) => {
          // The ingredient strip scrolls horizontally, and a scroll
          // container cannot clip on one axis only -- so its PADDING BOX is
          // the real clip rectangle every badge has to fit inside.
          const strip = row.querySelector(".recipe-output-ingredient-list")!;
          const clip = strip.getBoundingClientRect();
          const badges = Array.from(
            row.querySelectorAll(".recipe-output-ingredient-quantity-badge")
          );
          const overflow = badges.map((badge) => {
            const box = badge.getBoundingClientRect();
            return Math.max(clip.top - box.top, box.bottom - clip.bottom);
          });
          // Neighbouring chips must not sit under each other's badges.
          const chips = Array.from(
            row.querySelectorAll(".recipe-output-ingredient")
          ).map((chip) => chip.getBoundingClientRect());
          const overlaps = chips.slice(1).some((chip, index) => {
            const badge = badges[index]?.getBoundingClientRect();
            return badge ? badge.right > chip.left + 0.5 : false;
          });
          return {
            badgeCount: badges.length,
            worstOverflow: Math.max(...overflow),
            rowHeight: Math.round(row.getBoundingClientRect().height * 10) / 10,
            overlaps,
          };
        });
      });

      expect(rows.length, `${consumer.name} @${width}: has rows`).toBeGreaterThan(
        0
      );
      for (const row of rows) {
        const label = `${consumer.name} @${width}`;
        if (row.badgeCount === 0) continue;
        // Strictly inside, not merely flush.
        expect(
          row.worstOverflow,
          `${label}: quantity badge is fully inside the strip's clip box`
        ).toBeLessThan(0);
        expect(row.overlaps, `${label}: badges never cover the next chip`).toBe(
          false
        );
        // The fix must not have re-inflated the row.
        expect(row.rowHeight, `${label}: row stays compact`).toBeLessThanOrEqual(
          66
        );
      }
    }
  });
}

test("Profession and EXP follow the /recipes directory List scale and spacing", async ({
  page,
}) => {
  // The main directory List is the stated visual authority for this row.
  // Read its own values first, then hold every compact consumer to them.
  const reference: Record<string, { profession: string; exp: string; gap: number }> =
    {};

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1080 });
    await openList(page, "/recipes", ".recipe-output-card--directory-list");
    reference[width] = await page.evaluate(() => {
      // Not every Recipe has a Profession, so read the first row that
      // actually renders one rather than assuming the first row does.
      const row = Array.from(
        document.querySelectorAll(".recipe-output-card--directory-list")
      ).find((candidate) =>
        candidate.querySelector(
          ".recipe-output-list-profession > span:first-child"
        )
      )!;
      const profession = row.querySelector(
        ".recipe-output-list-profession > span:first-child"
      )!;
      const exp = row.querySelector(".recipe-output-experience")!;
      const cell = row.querySelector(".recipe-output-list-profession")!;
      return {
        profession: getComputedStyle(profession).fontSize,
        exp: getComputedStyle(exp).fontSize,
        gap:
          Math.round(
            (exp.getBoundingClientRect().left -
              cell.getBoundingClientRect().right) *
              10
          ) / 10,
      };
    });
  }

  // The authority itself must not ramp with viewport width: that is the
  // property the compact list was missing.
  expect(
    reference[1920]!.profession,
    "the directory Profession label is a fixed size"
  ).toBe(reference[3440]!.profession);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1080 });

    for (const consumer of CONSUMERS) {
      await openList(page, consumer.route);
      const measured = await page.evaluate(() => {
        // Same reasoning as the reference read: prefer a row that carries a
        // Profession, falling back to the first row for the EXP check.
        const rows = Array.from(
          document.querySelectorAll(".recipe-output-card--list")
        );
        const row =
          rows.find((candidate) =>
            candidate.querySelector(
              ".recipe-output-requirement > span:first-child"
            )
          ) ?? rows[0]!;
        const cell = row.querySelector(".recipe-output-requirement");
        const profession = row.querySelector(
          ".recipe-output-requirement > span:first-child"
        );
        const exp = row.querySelector(".recipe-output-experience")!;
        const professionStyle = profession
          ? getComputedStyle(profession)
          : null;
        return {
          hasProfession: Boolean(profession),
          professionFontSize: professionStyle?.fontSize ?? null,
          professionWeight: professionStyle?.fontWeight ?? null,
          professionTransform: professionStyle?.textTransform ?? null,
          expFontSize: getComputedStyle(exp).fontSize,
          gap: cell
            ? Math.round(
                (exp.getBoundingClientRect().left -
                  cell.getBoundingClientRect().right) *
                  10
              ) / 10
            : null,
        };
      });

      const label = `${consumer.name} @${width}`;
      if (measured.hasProfession) {
        expect(
          measured.professionFontSize,
          `${label}: Profession matches the directory scale`
        ).toBe(reference[width]!.profession);
        expect(
          measured.professionTransform,
          `${label}: Profession stays uppercase`
        ).toBe("uppercase");
        expect(measured.professionWeight, `${label}: Profession weight`).toBe(
          "600"
        );
        expect(
          measured.gap,
          `${label}: Profession-to-EXP separation matches the directory`
        ).toBeCloseTo(reference[width]!.gap, 0);
      }
      expect(measured.expFontSize, `${label}: EXP matches the directory`).toBe(
        reference[width]!.exp
      );
    }
  }
});

test("the compact List shows every ingredient inline and never discloses", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  for (const consumer of CONSUMERS) {
    await openList(page, consumer.route);
    const shape = await page.evaluate(() => {
      const row = document.querySelector(".recipe-output-card--list")!;
      return {
        chips: row.querySelectorAll(".recipe-output-ingredient").length,
        disclosures: row.querySelectorAll(
          ".recipe-output-ingredient-toggle, .recipe-output-ingredient-disclosure"
        ).length,
      };
    });
    expect(shape.chips, `${consumer.name}: renders its ingredients`).toBeGreaterThan(
      0
    );
    expect(
      shape.disclosures,
      `${consumer.name}: the List never hides ingredients behind a chevron`
    ).toBe(0);
  }

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );
  expect(overflows, "no horizontal overflow").toBe(false);
});

test("the compact GRID card is untouched by the List geometry", async ({
  page,
}) => {
  // The Grid variant is approved as-is. Its chip size, its own badge offset
  // and its disclosure all belong to a different rule set, so a change to
  // the List must not reach them.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/professions/smithing", { waitUntil: "domcontentloaded" });

  const grid = await page.evaluate(() => {
    const card = document.querySelector(".recipe-output-card--grid");
    if (!card) return null;
    const chip = card.querySelector(".recipe-output-ingredient");
    const badge = card.querySelector(".recipe-output-ingredient-quantity-badge");
    return {
      chipHeight: chip
        ? Math.round(chip.getBoundingClientRect().height * 10) / 10
        : null,
      badgeBottom: badge ? getComputedStyle(badge).bottom : null,
      badgeRight: badge ? getComputedStyle(badge).right : null,
      badgeShadow: badge ? getComputedStyle(badge).boxShadow : null,
    };
  });

  expect(grid, "the Grid card renders").not.toBeNull();
  // The Grid keeps the shared base badge offset -- the List's tighter tuck
  // is scoped to the List alone.
  expect(grid!.badgeBottom, "Grid badge keeps its own offset").toBe("-6px");
  expect(grid!.badgeRight, "Grid badge keeps its own offset").toBe("-6px");
  expect(grid!.badgeShadow, "Grid badge keeps its 2px separator ring").toContain(
    "2px"
  );
});
