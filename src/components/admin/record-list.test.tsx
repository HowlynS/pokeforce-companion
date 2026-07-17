// Component tests for the Slice 9B.3 shared record list and its
// pagination primitive, rendered to static HTML with react-dom/server
// (Node-only, no DOM library — the established component-test approach).
// The contract under test: the CALLER owns queries, filtering, and every
// href; the component renders exactly what it is given, marks at most
// the selected rows the caller flags, keeps search URL-driven, and never
// renders dead or fake controls (no Clear without a query, no clickable
// disabled pagination).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordList } from "@/components/admin/record-list";
import { RecordListPagination } from "@/components/admin/record-list-pagination";

const BASE_ROWS = [
  {
    href: "/admin/items/iron-ore/edit",
    primary: "Iron Ore",
    secondary: "Materials",
    selected: true,
  },
  { href: "/admin/items/oak-log/edit", primary: "Oak Log" },
] as const;

function renderList(
  overrides: Partial<React.ComponentProps<typeof RecordList>> = {}
) {
  return renderToStaticMarkup(
    <RecordList
      label="Items"
      searchAction="/admin/items"
      createHref="/admin/items/new"
      rows={BASE_ROWS}
      empty={<p>No records.</p>}
      {...overrides}
    />
  );
}

describe("RecordList search", () => {
  it("renders a GET search form with the default parameter name and preserved value", () => {
    const html = renderList({ searchValue: "iron" });

    expect(html).toMatch(/<form [^>]*action="\/admin\/items"[^>]*>/);
    expect(html).toMatch(/<form [^>]*method="get"[^>]*>/);
    expect(html).toMatch(/<input [^>]*name="q"[^>]*>/);
    expect(html).toMatch(/<input [^>]*value="iron"[^>]*>/);
  });

  it("accepts a caller-supplied parameter name", () => {
    const html = renderList({ searchParamName: "search" });

    expect(html).toMatch(/<input [^>]*name="search"[^>]*>/);
  });

  it("labels the search accessibly and submits with a real button", () => {
    const html = renderList({ searchLabel: "Search items" });

    expect(html).toContain('aria-label="Search items"');
    expect(html).toMatch(/<button [^>]*type="submit"[^>]*>Search<\/button>/);
  });

  it("shows the clear-search link only while a query is applied", () => {
    const withQuery = renderList({ searchValue: "iron" });
    const withoutQuery = renderList();

    expect(withQuery).toContain("Clear search");
    expect(withQuery).toMatch(/<a [^>]*href="\/admin\/items"[^>]*>Clear search/);
    expect(withoutQuery).not.toContain("Clear search");
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

  it("preserves query strings in caller-supplied row links", () => {
    const html = renderList({
      rows: [
        {
          href: "/admin/items/iron-ore/edit?q=iron&page=2",
          primary: "Iron Ore",
        },
      ],
    });

    expect(html).toContain('href="/admin/items/iron-ore/edit?q=iron&amp;page=2"');
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
      rows: [{ href: "/admin/items/oak-log/edit", primary: "Oak Log" }],
    });

    expect(html).not.toContain("aria-current");
  });

  it("renders the create action as a link", () => {
    const html = renderList({ createLabel: "+ New item" });

    expect(html).toMatch(/<a [^>]*href="\/admin\/items\/new"[^>]*>\+ New item<\/a>/);
  });
});

describe("RecordList optional regions", () => {
  it("renders the caller-supplied empty state instead of a list when there are no rows", () => {
    const html = renderList({ rows: [], searchValue: "zzz" });

    expect(html).toContain("No records.");
    expect(html).not.toContain("<ul");
    // The search form (and its Clear link) stays available so the admin
    // can leave the empty result set.
    expect(html).toContain("Clear search");
  });

  it("omits count and pagination when not supplied", () => {
    const html = renderList();

    expect(html).not.toContain("admin-record-count");
    expect(html).not.toContain("admin-record-pagination");
  });

  it("renders count and pagination when supplied", () => {
    const html = renderList({
      countLabel: "2 of 16 records",
      pagination: (
        <RecordListPagination context="Page 1" nextHref="/admin/items?page=2" />
      ),
    });

    expect(html).toContain("2 of 16 records");
    expect(html).toContain("admin-record-pagination");
  });
});

describe("RecordListPagination", () => {
  it("renders enabled directions as links that preserve search parameters", () => {
    const html = renderToStaticMarkup(
      <RecordListPagination
        context="Page 2"
        previousHref="/admin/items?q=iron&page=1"
        nextHref="/admin/items?q=iron&page=3"
      />
    );

    expect(html).toContain('href="/admin/items?q=iron&amp;page=1"');
    expect(html).toContain('href="/admin/items?q=iron&amp;page=3"');
    expect(html).toContain("Page 2");
    expect(html).toContain('aria-label="Pagination"');
  });

  it("renders an omitted direction as a plainly disabled marker, never a fake link", () => {
    const html = renderToStaticMarkup(
      <RecordListPagination context="Page 1" nextHref="/admin/items?page=2" />
    );

    // Previous is disabled: an aria-disabled span with no href anywhere
    // around it; Next stays a real link.
    expect(html).toMatch(
      /<span [^>]*aria-disabled="true"[^>]*>← Previous<\/span>/
    );
    expect(html).not.toMatch(/<a [^>]*>← Previous<\/a>/);
    expect(html).toMatch(/<a [^>]*href="\/admin\/items\?page=2"[^>]*>Next →<\/a>/);
  });

  it("disables both directions for a single page", () => {
    const html = renderToStaticMarkup(
      <RecordListPagination context="Page 1" />
    );

    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(html).not.toContain("<a ");
  });
});
