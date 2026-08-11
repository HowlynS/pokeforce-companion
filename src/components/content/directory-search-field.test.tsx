import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DirectorySearchField } from "@/components/content/directory-search-field";
import { PublicSiteSearch } from "@/components/layout/public-site-search";

describe("shared public search interaction", () => {
  it("marks the header and directory forms with the shared interaction primitive", () => {
    const header = renderToStaticMarkup(<PublicSiteSearch />);
    const directory = renderToStaticMarkup(
      <DirectorySearchField
        basePath="/recipes"
        placeholder="Find a recipe by name..."
        defaultValue="iron"
        preserve={{ profession: ["smithing", "alchemy"] }}
        ariaLabel="Search recipes"
        submitLabel="Search Recipes"
      />,
    );

    expect(header).toContain(
      'class="public-search-field public-site-search"',
    );
    expect(directory).toContain(
      'class="public-search-field directory-search-field"',
    );
  });

  it("preserves the directory GET contract, query value, filters, and labels", () => {
    const html = renderToStaticMarkup(
      <DirectorySearchField
        basePath="/recipes"
        placeholder="Find a recipe by name..."
        defaultValue="iron"
        preserve={{ profession: ["smithing", "alchemy"] }}
        ariaLabel="Search recipes"
        submitLabel="Search Recipes"
      />,
    );

    expect(html).toContain('action="/recipes"');
    expect(html).toContain('method="get"');
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Search recipes"');
    expect(html).toContain('type="search"');
    expect(html).toContain('name="q"');
    expect(html).toContain('value="iron"');
    expect(html).toContain('name="profession" value="smithing"');
    expect(html).toContain('name="profession" value="alchemy"');
    expect(html).toContain('aria-label="Search Recipes"');
  });
});
