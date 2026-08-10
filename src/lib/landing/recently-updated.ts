import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

export type RecentlyUpdatedEntry = {
  name: string;
  kind: string;
  href: string;
  updatedAt: Date;
};

/**
 * Real "recently updated" activity for the landing page, drawn from the two
 * resource types with the richest edit history (Items, Recipes) rather than
 * every table — a defensible, honest subset, not the handoff's invented
 * per-entry editorial notes ("yield revised", "price checked"), which have
 * no equivalent field in the schema. `limit` items are returned, most
 * recent first.
 */
export async function loadRecentlyUpdatedEntries(
  db: PrismaClient,
  limit: number,
): Promise<RecentlyUpdatedEntry[]> {
  const perType = limit;
  const [items, recipes] = await Promise.all([
    db.item.findMany({
      select: {
        name: true,
        slug: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: perType,
    }),
    db.recipe.findMany({
      select: {
        name: true,
        slug: true,
        updatedAt: true,
        profession: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: perType,
    }),
  ]);

  const entries: RecentlyUpdatedEntry[] = [
    ...items.map((item) => ({
      name: item.name,
      kind: item.category ? `Item — ${item.category.name}` : "Item",
      href: `/items/${item.slug}`,
      updatedAt: item.updatedAt,
    })),
    ...recipes.map((recipe) => ({
      name: recipe.name,
      kind: recipe.profession
        ? `Recipe — ${recipe.profession.name}`
        : "Recipe",
      href: `/recipes/${recipe.slug}`,
      updatedAt: recipe.updatedAt,
    })),
  ];

  entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return entries.slice(0, limit);
}

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

const RELATIVE_TIME_UNITS: readonly [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"],
  [60 * 60, "minute"],
  [60 * 60 * 24, "day"],
  [60 * 60 * 24 * 30, "week"],
  [60 * 60 * 24 * 365, "month"],
  [Infinity, "year"],
];

/** "3 days ago" / "yesterday" / "just now" — a real fact from `updatedAt`,
    never an invented editorial note. */
export function formatRelativeUpdate(updatedAt: Date, now = new Date()): string {
  const seconds = Math.round((updatedAt.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) {
    return "Updated just now";
  }

  let divisor = 1;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [threshold, thresholdUnit] of RELATIVE_TIME_UNITS) {
    if (absSeconds < threshold) {
      unit = thresholdUnit;
      break;
    }
    divisor = threshold;
  }

  const value = Math.round(seconds / divisor);
  return `Updated ${RELATIVE_TIME_FORMATTER.format(value, unit)}`;
}
