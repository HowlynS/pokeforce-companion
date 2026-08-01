import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesignReviewWorkspace } from "@/components/admin/design-review-workspace";

describe("DesignReviewWorkspace", () => {
  it("renders an allowlisted public preview with selectors and expectations", () => {
    const html = renderToStaticMarkup(
      <DesignReviewWorkspace
        initialContractId="item-detail"
        initialFixtureKey="item-no-image"
        initialViewportId="mobile-390"
        appearanceVersion="test-version"
      />
    );

    expect(html).toContain("Contract and state");
    expect(html).toContain("No-image Item detail");
    expect(html).toContain("390×844");
    expect(html).toContain("Contract expectations");
    expect(html).toContain("Loading public preview");
    expect(html).toContain('src="/items/design-review-item-no-image-long-name"');
    expect(html).toContain('sandbox="allow-forms allow-popups allow-same-origin allow-scripts"');
    expect(html).not.toContain("/admin/appearance");
  });

  it("keeps public URLs and iframe titles deterministic", () => {
    const html = renderToStaticMarkup(
      <DesignReviewWorkspace
        initialContractId="shop-detail"
        initialFixtureKey="shop-dense"
        initialViewportId="desktop-1920"
        appearanceVersion="default"
      />
    );
    expect(html).toContain('href="/shops/design-review-shop-dense"');
    expect(html).toContain(
      'title="Design review preview: Shop detail — Dense Shop detail"'
    );
  });
});
