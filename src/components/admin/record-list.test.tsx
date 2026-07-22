// Component tests for the Phase B1 (System A) shared, client-side
// filtering record list, rendered to static HTML with react-dom/server
// (Node-only, no DOM library — the established component-test approach).
// react-dom/server never runs effects or handles real user input, but the
// initial render itself is deterministic from props: `query` state is
// seeded synchronously from `initialQuery`, and filtering/count wording is
// computed synchronously from that same first-render state — so the
// filtering CONTRACT (which rows show, which count text renders, which
// empty variant appears) is fully verifiable here for a given initial
// query, even though actual typing/Escape/debounced-URL-sync behavior is
// interactive and covered by E2E instead. The contract under test: the
// CALLER still owns every row's data/href/image, the component filters
// locally by name or Page address only, marks at most the selected row,
// never renders a submit button or pagination, and never renders a dead
// or fake control.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordList } from "@/components/admin/record-list";

const NOUN = { singular: "item", plural: "items" };

const BASE_ROWS = [
  {
    href: "/admin/items/iron-ore/edit",
    primary: "Iron Ore",
    slug: "iron-ore",
    secondary: "Materials",
    selected: true,
  },
  { href: "/admin/items/oak-log/edit", primary: "Oak Log", slug: "oak-log" },
] as const;

function renderList(
  overrides: Partial<React.ComponentProps<typeof RecordList>> = {}
) {
  return renderToStaticMarkup(
    <RecordList
      label="Items"
      listPath="/admin/items"
      createHref="/admin/items/new"
      rows={BASE_ROWS}
      noun={NOUN}
      empty={<p>No records.</p>}
      {...overrides}
    />
  );
}

describe("RecordList filter input", () => {
  it("renders a search input seeded from initialQuery, with no surrounding form", () => {
    const html = renderList({ initialQuery: "iron" });

    expect(html).toMatch(/<input [^>]*type="search"[^>]*>/);
    expect(html).toMatch(/<input [^>]*value="iron"[^>]*>/);
    expect(html).not.toContain("<form");
  });

  it("labels the search landmark and input accessibly", () => {
    const html = renderList({ searchLabel: "Search items" });

    expect(html).toMatch(/<div [^>]*role="search"[^>]*aria-label="Search items"/);
    expect(html).toContain('aria-label="Search items"');
  });

  it("never renders a submit button", () => {
    const html = renderList();

    expect(html).not.toMatch(/<button [^>]*type="submit"/);
    expect(html).not.toContain(">Search<");
  });

  it("shows the inline clear button only while a query is applied", () => {
    const withQuery = renderList({ initialQuery: "iron" });
    const withoutQuery = renderList();

    expect(withQuery).toMatch(
      /<button [^>]*aria-label="Clear search"[^>]*class="admin-record-clear"[^>]*>/
    );
    expect(withoutQuery).not.toContain("Clear search");
  });

  it("uses a concise placeholder without relying on it as the only label", () => {
    const html = renderList();

    expect(html).toContain("Filter records");
    expect(html).toContain('aria-label="Search records"');
  });
});

describe("RecordList case-insensitive/slug filtering (initial render)", () => {
  it("matches by name, case-insensitively", () => {
    const html = renderList({ initialQuery: "IRON" });

    expect(html).toContain("Iron Ore");
    expect(html).not.toContain("Oak Log");
  });

  it("matches by Page address (slug)", () => {
    const html = renderList({ initialQuery: "oak-log" });

    expect(html).toContain("Oak Log");
    expect(html).not.toContain("Iron Ore");
  });

  it("trims the initial query before filtering", () => {
    const html = renderList({ initialQuery: "  iron  " });

    expect(html).toContain("Iron Ore");
    expect(html).not.toContain("Oak Log");
  });

  it("matches by an optional searchTerms value (e.g. Location's type label), never displayed as its own text", () => {
    const html = renderList({
      initialQuery: "dungeon",
      rows: [
        {
          href: "/admin/locations/sunken-cave/edit",
          primary: "Sunken Cave",
          slug: "sunken-cave",
          searchTerms: ["Dungeon"],
        },
        {
          href: "/admin/locations/millbrook/edit",
          primary: "Millbrook",
          slug: "millbrook",
          searchTerms: ["Town"],
        },
      ],
    });

    expect(html).toContain("Sunken Cave");
    expect(html).not.toContain("Millbrook");
  });

  it("a row set omitting searchTerms behaves exactly as before (other resources unaffected)", () => {
    const html = renderList({ initialQuery: "iron" });

    expect(html).toContain("Iron Ore");
    expect(html).not.toContain("Oak Log");
  });

  it("a blank query restores every row", () => {
    const html = renderList({ initialQuery: "" });

    expect(html).toContain("Iron Ore");
    expect(html).toContain("Oak Log");
  });
});

describe("RecordList rows and selection", () => {
  it("renders primary labels, optional secondary context, and caller hrefs verbatim", () => {
    const html = renderList();

    expect(html).toContain('href="/admin/items/iron-ore/edit"');
    expect(html).toContain("Iron Ore");
    expect(html).toContain("Materials");
    expect(html).toContain("Oak Log");
    // The row WITHOUT secondary context renders no empty secondary span.
    expect(html.match(/admin-record-secondary/g)).toHaveLength(1);
  });

  it("preserves unrelated query strings in caller-supplied row links", () => {
    const html = renderList({
      rows: [
        {
          href: "/admin/items/iron-ore/edit?success=updated",
          primary: "Iron Ore",
          slug: "iron-ore",
        },
      ],
    });

    expect(html).toContain('href="/admin/items/iron-ore/edit?success=updated"');
  });

  it("rewrites the row href's own filter parameter to match the initial query", () => {
    const html = renderList({
      initialQuery: "iron",
      rows: [
        {
          href: "/admin/items/iron-ore/edit?q=stale",
          primary: "Iron Ore",
          slug: "iron-ore",
        },
      ],
    });

    expect(html).toContain('href="/admin/items/iron-ore/edit?q=iron"');
  });

  it("marks exactly the selected row with aria-current", () => {
    const html = renderList();

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<a [^>]*href="\/admin\/items\/iron-ore\/edit"[^>]*aria-current="page"/
    );
  });

  it("marks no row when the caller selects none", () => {
    const html = renderList({
      rows: [{ href: "/admin/items/oak-log/edit", primary: "Oak Log", slug: "oak-log" }],
    });

    expect(html).not.toContain("aria-current");
  });

  it("keeps the selected row's styling even while it no longer matches the filter (it simply is not rendered, never breaking the editor)", () => {
    // The selected row disappearing from a filtered view is expected
    // (per spec: "the selected record may disappear from the filtered
    // result if it does not match") — this asserts the OTHER, matching
    // row's own aria-current is unaffected by the selected row being
    // filtered out, i.e. selection state is never silently reassigned.
    const html = renderList({ initialQuery: "oak" });

    expect(html).toContain("Oak Log");
    expect(html).not.toContain("Iron Ore");
    expect(html).not.toContain("aria-current");
  });

  it("renders the create action as a link", () => {
    const html = renderList({ createLabel: "+ New item" });

    expect(html).toMatch(/<a [^>]*href="\/admin\/items\/new"[^>]*>\+ New item<\/a>/);
  });
});

describe("RecordList count wording", () => {
  it("shows only the total with no active filter", () => {
    const html = renderList();

    expect(html).toContain("2 items");
  });

  it("shows the filtered-of-total form while a filter is active", () => {
    const html = renderList({ initialQuery: "iron" });

    expect(html).toContain("1 of 2 items");
  });

  it("uses singular wording for a single-record total", () => {
    const html = renderList({
      rows: [{ href: "/admin/items/oak-log/edit", primary: "Oak Log", slug: "oak-log" }],
    });

    expect(html).toContain("1 item");
    expect(html).not.toContain("1 items");
  });
});

describe("RecordList empty states", () => {
  it("renders the caller-supplied empty state only when there are truly no records", () => {
    const html = renderList({ rows: [] });

    expect(html).toContain("No records.");
    expect(html).not.toContain("<ul");
    // The search landmark stays available even with zero records.
    expect(html).toContain('role="search"');
  });

  it("renders the compact filtered-empty state, never the caller's true-empty message, when records exist but none match", () => {
    const html = renderList({ initialQuery: "does-not-exist" });

    expect(html).toContain("No matching records.");
    expect(html).not.toContain("No records.");
    expect(html).not.toContain("<ul");
  });

  it("still shows the total count and the search field during a filtered-empty result", () => {
    const html = renderList({ initialQuery: "does-not-exist" });

    expect(html).toContain("0 of 2 items");
    expect(html).toMatch(/<input [^>]*type="search"/);
  });

  it("never renders pagination anywhere", () => {
    const html = renderList();

    expect(html).not.toContain("admin-record-pagination");
    expect(html).not.toContain("Pagination");
    expect(html).not.toContain("Previous");
    expect(html).not.toContain("Next");
  });
});

describe("RecordList image-capable mode (showImages)", () => {
  const IMAGE_ROWS = [
    {
      href: "/admin/items/iron-ore/edit",
      primary: "Iron Ore",
      slug: "iron-ore",
      secondary: "Materials",
      selected: true,
      image: "https://example.test/storage/items/iron-ore.png",
    },
    {
      href: "/admin/items/oak-log/edit",
      primary: "Oak Log",
      slug: "oak-log",
      image: null,
    },
  ] as const;

  it("renders a real image with an empty decorative alt attribute", () => {
    const html = renderList({ showImages: true, rows: IMAGE_ROWS });

    expect(html).toMatch(
      /<img [^>]*src="https:\/\/example\.test\/storage\/items\/iron-ore\.png"[^>]*>/
    );
    expect(html).toMatch(/<img [^>]*alt=""[^>]*>/);
    expect(html).toMatch(/<img [^>]*class="admin-record-thumb-img"[^>]*>/);
  });

  it("renders the fallback slot (no <img>) for a null image, hidden from assistive technology", () => {
    const html = renderList({ showImages: true, rows: IMAGE_ROWS });

    expect(html).toMatch(
      /<span class="admin-record-thumb-wrap admin-record-thumb-empty" aria-hidden="true"\s*\/?>\s*<\/span>/
    );
    expect(html.match(/<img /g)).toHaveLength(1);
  });

  it("gives every row the same media slot regardless of whether its own image is populated", () => {
    const html = renderList({ showImages: true, rows: IMAGE_ROWS });

    expect(html.match(/admin-record-thumb-wrap/g)).toHaveLength(2);
  });

  it("renders no media wrapper at all in text-only mode (the default)", () => {
    const html = renderList({ rows: BASE_ROWS });

    expect(html).not.toContain("admin-record-thumb-wrap");
    expect(html).not.toContain("admin-record-link-media");
  });

  it("keeps primary/secondary text, hrefs, and selection unchanged in image-capable mode", () => {
    const html = renderList({ showImages: true, rows: IMAGE_ROWS });

    expect(html).toContain('href="/admin/items/iron-ore/edit"');
    expect(html).toContain("Iron Ore");
    expect(html).toContain("Materials");
    expect(html).toContain("Oak Log");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
