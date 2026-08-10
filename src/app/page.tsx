import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import {
  formatRelativeUpdate,
  loadRecentlyUpdatedEntries,
} from "@/lib/landing/recently-updated";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

// Real per-resource counts (fetched below) are appended to each card as a
// gold pill, matching the handoff's "Start Anywhere" pillars. No NPCs
// pillar: there is no NPC model or route in production.
const resourceCards = [
  {
    title: "Items",
    description: "Materials, tools, and goods with their sources and uses.",
    href: "/items",
    countKey: "items",
  },
  {
    title: "Recipes",
    description: "Ingredients, professions, and crafting combinations.",
    href: "/recipes",
    countKey: "recipes",
  },
  {
    title: "Professions",
    description: "Skills, specialties, and what they can create.",
    href: "/professions",
    countKey: "professions",
  },
  {
    title: "Classes",
    description: "Player classes in the PokeForce world.",
    href: "/classes",
    countKey: "classes",
  },
  {
    title: "Locations",
    description: "Regions, routes, and points of interest.",
    href: "/locations",
    countKey: "locations",
  },
  {
    title: "Shops",
    description: "Vendors, inventories, currencies, and prices.",
    href: "/shops",
    countKey: "shops",
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Find an entry",
    body: "Search by name or browse a directory — every list filters by category or profession.",
  },
  {
    step: "2",
    title: "Follow the links",
    body: "Chips on every page jump to the profession, location, or shop behind an entry.",
  },
  {
    step: "3",
    title: "Trace the chain",
    body: "Recipes list what they consume and where each ingredient comes from.",
  },
] as const;

function staggerDelay(index: number, step = 30, max = 330): number {
  return Math.min(index * step, max);
}

export default async function Home() {
  // Independent aggregate queries, run concurrently — the landing page
  // needs only totals and a small recently-updated slice, so no full
  // record collections are loaded merely to count or preview them.
  const [
    itemCount,
    recipeCount,
    professionCount,
    classCount,
    locationCount,
    shopCount,
    recentlyUpdated,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.recipe.count(),
    prisma.profession.count(),
    prisma.playerClass.count(),
    prisma.location.count(),
    prisma.shop.count(),
    loadRecentlyUpdatedEntries(prisma, 6),
  ]);

  const statistics = [
    { label: "Items", count: itemCount },
    { label: "Recipes", count: recipeCount },
    { label: "Locations", count: locationCount },
    { label: "Shops", count: shopCount },
  ] as const;

  const resourceCounts: Record<string, number> = {
    items: itemCount,
    recipes: recipeCount,
    professions: professionCount,
    classes: classCount,
    locations: locationCount,
    shops: shopCount,
  };

  return (
    <AppShell landing scenic="home">
      <div className="landing-page">
        <section className="landing-overview" aria-labelledby="landing-title">
          <div className="landing-hero-copy cx-rise">
            <p className="landing-hero-eyebrow">
              <span className="landing-hero-eyebrow-rule" aria-hidden="true" />
              A Trader&apos;s Field Guide
              <span
                className="landing-hero-eyebrow-rule landing-hero-eyebrow-rule--end"
                aria-hidden="true"
              />
            </p>
            <h1 id="landing-title">Merchants Codex</h1>
            <p className="landing-hero-description">
              Every item, recipe, profession, and vendor — cross-referenced
              and traced back to where they come from.
            </p>
            <div className="landing-hero-actions">
              <Link href="/items" className="landing-cta landing-cta-primary">
                Browse the Codex
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link href="/recipes" className="landing-cta landing-cta-ghost">
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
            <h2 id="landing-resources-title">Start Anywhere</h2>
            <span className="landing-section-rule cx-line-sweep" aria-hidden="true" />
          </div>

          <div className="landing-resource-grid">
            {resourceCards.map((resource, index) => (
              <Link
                key={resource.href}
                href={resource.href}
                className="landing-resource-card cx-item-in"
                style={{ animationDelay: `${staggerDelay(index)}ms` }}
              >
                <span
                  className="landing-resource-sprite-slot"
                  aria-hidden="true"
                />
                <div className="landing-resource-card-body">
                  <div className="landing-resource-card-heading">
                    <h3>{resource.title}</h3>
                    <span className="landing-resource-count-pill">
                      {numberFormatter.format(
                        resourceCounts[resource.countKey] ?? 0,
                      )}{" "}
                      entries
                    </span>
                  </div>
                  <p>{resource.description}</p>
                </div>
                <svg
                  className="landing-resource-affordance"
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-lower-band">
          <div className="landing-recent" aria-labelledby="landing-recent-title">
            <div className="landing-section-heading">
              <h2 id="landing-recent-title">Recently Updated</h2>
              <span className="landing-section-rule" aria-hidden="true" />
            </div>

            {recentlyUpdated.length > 0 ? (
              <div className="landing-recent-list">
                {recentlyUpdated.map((entry, index) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="landing-recent-row cx-item-in"
                    style={{ animationDelay: `${staggerDelay(index)}ms` }}
                  >
                    <span
                      className="landing-recent-sprite-slot"
                      aria-hidden="true"
                    />
                    <span className="landing-recent-copy">
                      <span className="landing-recent-name">{entry.name}</span>
                      <span className="landing-recent-kind">{entry.kind}</span>
                    </span>
                    <span className="landing-recent-note">
                      {formatRelativeUpdate(entry.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="landing-side-panels">
            <div className="landing-how-it-works">
              <p className="landing-how-it-works-title">How the Codex Works</p>
              <ol className="landing-how-it-works-list">
                {HOW_IT_WORKS.map((step) => (
                  <li key={step.step}>
                    <span className="landing-how-step-badge" aria-hidden="true">
                      {step.step}
                    </span>
                    <span className="landing-how-step-copy">
                      <span className="landing-how-step-title">
                        {step.title}
                      </span>
                      <span className="landing-how-step-body">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <Link href="/recipes" className="landing-promo-card">
              <span className="landing-promo-title">Crafting Chains</span>
              <p className="landing-promo-body">
                Follow any ingredient upward through every recipe that uses
                it, and downward to the shop that sells it.
              </p>
              <span className="landing-promo-cta">
                Open the recipe index
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
