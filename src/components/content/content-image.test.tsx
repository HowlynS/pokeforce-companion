import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/storage/images", () => ({
  getImagePublicUrl: async (path: string | null) =>
    path ? `https://images.example/${path}` : null,
}));

import { ContentImage } from "@/components/content/content-image";

describe("ContentImage", () => {
  it("preserves a stored sprite URL and square card dimensions", async () => {
    const html = renderToStaticMarkup(
      await ContentImage({
        imagePath:
          "items/test-e2e-public-profession-detail-celestine-relay-core.png",
        alt: "Image of Test E2E Celestine Relay Core",
        size: "card",
      })
    );

    expect(html).toContain(
      'class="public-sprite-stage public-sprite-stage--card"'
    );
    expect(html).toContain('class="public-sprite-image"');
    expect(html).toContain(
      "test-e2e-public-profession-detail-celestine-relay-core.png"
    );
    expect(html).toContain(
      'alt="Image of Test E2E Celestine Relay Core"'
    );
    expect(html).toContain('width="96"');
    expect(html).toContain('height="96"');
    expect(html).not.toContain("public-sprite-stage--empty");
  });

  it("keeps the accessible no-image fallback inside the same card stage", async () => {
    const html = renderToStaticMarkup(
      await ContentImage({
        imagePath: null,
        alt: "Image of an unpictured fixture Item",
        size: "card",
      })
    );

    expect(html).toContain(
      'class="public-sprite-stage public-sprite-stage--card public-sprite-stage--empty"'
    );
    expect(html).toContain('aria-label="No image available"');
    expect(html).toContain("No image available");
    expect(html).not.toContain("<img");
  });
});
