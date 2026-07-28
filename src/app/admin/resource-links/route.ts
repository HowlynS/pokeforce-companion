import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  RESOURCE_LINK_SEARCH_LIMIT,
  RESOURCE_LINK_SEARCH_MIN_LENGTH,
  type ResourceLinkOption,
} from "@/lib/admin/resource-link";

async function resolveResourceLink(href: string) {
  const match = href.match(
    /^\/(items|recipes|professions|classes|categories|locations|shops)\/([^/?#]+)$/
  );
  if (!match) {
    return null;
  }

  let slug: string;
  try {
    slug = decodeURIComponent(match[2]);
  } catch {
    return null;
  }

  switch (match[1]) {
    case "items": {
      const item = await prisma.item.findUnique({
        where: { slug },
        select: { name: true, slug: true, category: { select: { name: true } } },
      });
      return item
        ? ({
            type: "Item",
            name: item.name,
            href: `/items/${item.slug}`,
            context: item.category?.name ?? null,
          } satisfies ResourceLinkOption)
        : null;
    }
    case "recipes": {
      const recipe = await prisma.recipe.findUnique({
        where: { slug },
        select: {
          name: true,
          slug: true,
          profession: { select: { name: true } },
        },
      });
      return recipe
        ? ({
            type: "Recipe",
            name: recipe.name,
            href: `/recipes/${recipe.slug}`,
            context: recipe.profession?.name ?? null,
          } satisfies ResourceLinkOption)
        : null;
    }
    case "professions": {
      const profession = await prisma.profession.findUnique({
        where: { slug },
        select: { name: true, slug: true },
      });
      return profession
        ? ({
            type: "Profession",
            name: profession.name,
            href: `/professions/${profession.slug}`,
            context: null,
          } satisfies ResourceLinkOption)
        : null;
    }
    case "classes": {
      const playerClass = await prisma.playerClass.findUnique({
        where: { slug },
        select: { name: true, slug: true },
      });
      return playerClass
        ? ({
            type: "Class",
            name: playerClass.name,
            href: `/classes/${playerClass.slug}`,
            context: null,
          } satisfies ResourceLinkOption)
        : null;
    }
    case "categories": {
      const category = await prisma.category.findUnique({
        where: { slug },
        select: { name: true, slug: true },
      });
      return category
        ? ({
            type: "Category",
            name: category.name,
            href: `/categories/${category.slug}`,
            context: null,
          } satisfies ResourceLinkOption)
        : null;
    }
    case "locations": {
      const location = await prisma.location.findUnique({
        where: { slug },
        select: { name: true, slug: true, type: true },
      });
      return location
        ? ({
            type: "Location",
            name: location.name,
            href: `/locations/${location.slug}`,
            context: location.type,
          } satisfies ResourceLinkOption)
        : null;
    }
    case "shops": {
      const shop = await prisma.shop.findUnique({
        where: { slug },
        select: {
          name: true,
          slug: true,
          location: { select: { name: true } },
        },
      });
      return shop
        ? ({
            type: "Shop",
            name: shop.name,
            href: `/shops/${shop.slug}`,
            context: shop.location.name,
          } satisfies ResourceLinkOption)
        : null;
    }
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  await requireAdminUser();

  const href = request.nextUrl.searchParams.get("href")?.trim() ?? "";
  if (href) {
    return NextResponse.json({ result: await resolveResourceLink(href) });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < RESOURCE_LINK_SEARCH_MIN_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const contains = { contains: query, mode: "insensitive" as const };
  const perTypeLimit = 6;
  const [items, recipes, professions, classes, categories, locations, shops] =
    await Promise.all([
      prisma.item.findMany({
        where: { name: contains },
        select: { name: true, slug: true, category: { select: { name: true } } },
        orderBy: { name: "asc" },
        take: perTypeLimit,
      }),
      prisma.recipe.findMany({
        where: { name: contains },
        select: {
          name: true,
          slug: true,
          profession: { select: { name: true } },
        },
        orderBy: { name: "asc" },
        take: perTypeLimit,
      }),
      prisma.profession.findMany({
        where: { name: contains },
        select: { name: true, slug: true },
        orderBy: { name: "asc" },
        take: perTypeLimit,
      }),
      prisma.playerClass.findMany({
        where: { name: contains },
        select: { name: true, slug: true },
        orderBy: { name: "asc" },
        take: perTypeLimit,
      }),
      prisma.category.findMany({
        where: { name: contains },
        select: { name: true, slug: true },
        orderBy: { name: "asc" },
        take: perTypeLimit,
      }),
      prisma.location.findMany({
        where: { name: contains },
        select: { name: true, slug: true, type: true },
        orderBy: { name: "asc" },
        take: perTypeLimit,
      }),
      prisma.shop.findMany({
        where: { name: contains },
        select: { name: true, slug: true, location: { select: { name: true } } },
        orderBy: { name: "asc" },
        take: perTypeLimit,
      }),
    ]);

  const results: ResourceLinkOption[] = [
    ...items.map((item) => ({
      type: "Item" as const,
      name: item.name,
      href: `/items/${item.slug}`,
      context: item.category?.name ?? null,
    })),
    ...recipes.map((recipe) => ({
      type: "Recipe" as const,
      name: recipe.name,
      href: `/recipes/${recipe.slug}`,
      context: recipe.profession?.name ?? null,
    })),
    ...professions.map((profession) => ({
      type: "Profession" as const,
      name: profession.name,
      href: `/professions/${profession.slug}`,
      context: null,
    })),
    ...classes.map((playerClass) => ({
      type: "Class" as const,
      name: playerClass.name,
      href: `/classes/${playerClass.slug}`,
      context: null,
    })),
    ...categories.map((category) => ({
      type: "Category" as const,
      name: category.name,
      href: `/categories/${category.slug}`,
      context: null,
    })),
    ...locations.map((location) => ({
      type: "Location" as const,
      name: location.name,
      href: `/locations/${location.slug}`,
      context: location.type,
    })),
    ...shops.map((shop) => ({
      type: "Shop" as const,
      name: shop.name,
      href: `/shops/${shop.slug}`,
      context: shop.location.name,
    })),
  ]
    .sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type))
    .slice(0, RESOURCE_LINK_SEARCH_LIMIT);

  return NextResponse.json({ results });
}
