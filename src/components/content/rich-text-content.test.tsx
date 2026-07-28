import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichTextContent } from "@/components/content/rich-text-content";

describe("RichTextContent", () => {
  it("renders the supported semantic structure and safe links", () => {
    const html = renderToStaticMarkup(
      <RichTextContent
        value={{
          version: 1,
          doc: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Section" }],
              },
              {
                type: "heading",
                attrs: { level: 3 },
                content: [{ type: "text", text: "Subsection" }],
              },
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Bold", marks: [{ type: "bold" }] },
                  {
                    type: "text",
                    text: " italic",
                    marks: [{ type: "italic" }],
                  },
                  {
                    type: "text",
                    text: " underline",
                    marks: [{ type: "underline" }],
                  },
                  {
                    type: "text",
                    text: " item",
                    marks: [
                      {
                        type: "link",
                        attrs: { href: "/items/iron-ore" },
                      },
                    ],
                  },
                  {
                    type: "text",
                    text: " source",
                    marks: [
                      {
                        type: "link",
                        attrs: { href: "https://example.com/source" },
                      },
                    ],
                  },
                ],
              },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "One" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }}
      />
    );

    expect(html).toContain("<h2>");
    expect(html).toContain("<h3>");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em> italic</em>");
    expect(html).toContain("<u> underline</u>");
    expect(html).toContain('<a href="/items/iron-ore"> item</a>');
    expect(html).toContain(
      '<a href="https://example.com/source" rel="noopener noreferrer"> source</a>'
    );
    expect(html).toContain("<ul><li><p>");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("renders migrated plain text and hides empty descriptions", () => {
    expect(
      renderToStaticMarkup(
        <RichTextContent value={null} fallback={"First\nSecond"} />
      )
    ).toContain("<p>First</p><p>Second</p>");
    expect(
      renderToStaticMarkup(<RichTextContent value={null} fallback="  " />)
    ).toBe("");
  });
});
