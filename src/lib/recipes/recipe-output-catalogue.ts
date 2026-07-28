import type { Prisma } from "@/generated/prisma/client";
import {
  cataloguePageHref,
  resolveCataloguePage,
} from "@/lib/catalogue-query";

export const RECIPE_OUTPUT_PAGE_SIZE = 12;

export const recipeOutputCardSelect = {
  id: true,
  slug: true,
  name: true,
  resultQuantityMin: true,
  resultQuantityMax: true,
  resultingItem: {
    select: {
      name: true,
      slug: true,
      image: true,
      category: { select: { name: true } },
    },
  },
  ingredients: {
    select: {
      id: true,
      quantity: true,
      item: {
        select: {
          name: true,
          slug: true,
          image: true,
        },
      },
    },
    orderBy: [{ item: { name: "asc" } }, { id: "asc" }],
  },
} satisfies Prisma.RecipeSelect;

export type RecipeOutputCardValue = Prisma.RecipeGetPayload<{
  select: typeof recipeOutputCardSelect;
}>;

export function resolveRecipeOutputPage(
  rawPage: string | string[] | undefined,
  recipeCount: number
): {
  currentPage: number;
  pageCount: number;
  skip: number;
} {
  return resolveCataloguePage(
    rawPage,
    recipeCount,
    RECIPE_OUTPUT_PAGE_SIZE
  );
}

export function recipeOutputPageHref(
  basePath: string,
  page: number,
  query?: Record<string, string | undefined>
): string {
  return cataloguePageHref(basePath, page, query);
}
