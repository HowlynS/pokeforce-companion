import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

const resourceCards = [
  {
    title: "Items",
    description: "Materials, tools, and goods with their sources and uses.",
    href: "/items",
  },
  {
    title: "Recipes",
    description: "Ingredients, professions, and crafting combinations.",
    href: "/recipes",
  },
  {
    title: "Professions",
    description: "Skills, specialties, and what they can create.",
    href: "/professions",
  },
  {
    title: "Classes",
    description: "Player classes in the PokeForce world.",
    href: "/classes",
  },
  {
    title: "Locations",
    description: "Regions, routes, and points of interest.",
    href: "/locations",
  },
  {
    title: "Shops",
    description: "Vendors, inventories, currencies, and prices.",
    href: "/shops",
  },
] as const;

export default async function Home() {
  // These are four independent aggregate queries, run concurrently. The
  // landing page needs only the totals, so no record collections or
  // relationships are loaded merely to count them.
  const [itemCount, recipeCount, locationCount, shopCount] = await Promise.all([
    prisma.item.count(),
    prisma.recipe.count(),
    prisma.location.count(),
    prisma.shop.count(),
  ]);

  const statistics = [
    { label: "Items", count: itemCount },
    { label: "Recipes", count: recipeCount },
    { label: "Locations", count: locationCount },
    { label: "Shops", count: shopCount },
  ] as const;

  return (
    <AppShell landing scenic="home">
      <div className="landing-page">
        <section className="landing-overview" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">Merchants Codex</p>
            <h1 id="landing-title">
              The Guild’s Knowledge.
              <span>Yours to Use.</span>
            </h1>
            <p className="landing-hero-description">
              A complete reference for items, recipes, locations, and the
              world&apos;s most valuable goods.
            </p>
            <div className="landing-hero-actions">
              <Link href="/items" className="btn btn-primary">
                Browse Items
              </Link>
              <Link href="/recipes" className="btn btn-secondary">
                Explore Recipes
              </Link>
            </div>
          </div>

          <dl className="landing-statistics" aria-label="Codex statistics">
            {statistics.map((statistic) => (
              <div
                key={statistic.label}
                className="landing-statistic"
                data-statistic={statistic.label.toLowerCase()}
              >
                <dt>{statistic.label}</dt>
                <dd>{numberFormatter.format(statistic.count)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="landing-resources"
          aria-labelledby="landing-resources-title"
        >
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Browse the archive</p>
            <h2 id="landing-resources-title">Guild resources</h2>
          </div>

          <div className="landing-resource-grid">
            {resourceCards.map((resource) => (
              <Link
                key={resource.href}
                href={resource.href}
                className="landing-resource-card"
              >
                <span
                  className="landing-resource-sprite-slot"
                  aria-hidden="true"
                />
                <h3>{resource.title}</h3>
                <p>{resource.description}</p>
                <span className="landing-resource-affordance">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
