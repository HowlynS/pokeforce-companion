import { describe, expect, it } from "vitest";
import {
  isSafeRichTextHref,
  normalizeRichTextValue,
  parseRichDescriptionInput,
  plainTextToRichText,
  resolveRichTextValue,
  richTextToPlainText,
  serializeRichTextValue,
} from "@/lib/rich-text";

const formattedDocument = {
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
          { type: "text", text: " italic", marks: [{ type: "italic" }] },
          { type: "text", text: " underline", marks: [{ type: "underline" }] },
          {
            type: "text",
            text: " internal",
            marks: [{ type: "link", attrs: { href: "/items/iron-ore" } }],
          },
          {
            type: "text",
            text: " external",
            marks: [
              { type: "link", attrs: { href: "https://example.com/reference" } },
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
                content: [{ type: "text", text: "First" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Second" }],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe("structured rich descriptions", () => {
  it("converts legacy plain text into ordered paragraphs without losing line breaks", () => {
    const value = plainTextToRichText("First line\n\nThird line");
    expect(value?.doc.content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "First line" }],
      },
      { type: "paragraph" },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Third line" }],
      },
    ]);
    expect(richTextToPlainText(value)).toBe("First line\n\nThird line");
  });

  it("accepts the complete supported node and mark subset deterministically", () => {
    const normalized = normalizeRichTextValue(formattedDocument);
    expect(normalized).not.toBeNull();
    expect(serializeRichTextValue(normalized)).toBe(
      serializeRichTextValue(normalizeRichTextValue(formattedDocument))
    );
    expect(richTextToPlainText(normalized)).toBe(
      "Section\nSubsection\nBold italic underline internal external\nFirst\nSecond"
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///tmp/bad",
    "http://example.com",
    "//example.com",
    "/admin/items",
  ])("rejects unsafe or unsupported link destination %s", (href) => {
    expect(isSafeRichTextHref(href)).toBe(false);
    expect(() =>
      normalizeRichTextValue({
        version: 1,
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Unsafe",
                  marks: [{ type: "link", attrs: { href } }],
                },
              ],
            },
          ],
        },
      })
    ).toThrow();
  });

  it.each([
    { type: "image", attrs: { src: "https://example.com/image.png" } },
    { type: "heading", attrs: { level: 1 } },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Color", marks: [{ type: "color" }] }],
    },
  ])("rejects unsupported nodes, heading levels, and marks", (node) => {
    expect(() =>
      normalizeRichTextValue({
        version: 1,
        doc: { type: "doc", content: [node] },
      })
    ).toThrow();
  });

  it("normalizes visually empty documents and whitespace-only input to null", () => {
    expect(
      normalizeRichTextValue({
        version: 1,
        doc: {
          type: "doc",
          content: [
            { type: "paragraph" },
            {
              type: "paragraph",
              content: [{ type: "text", text: "   " }],
            },
          ],
        },
      })
    ).toBeNull();
    expect(plainTextToRichText(" \n ")).toBeNull();
  });

  it("falls back to an existing plain description when structured data is absent or invalid", () => {
    expect(resolveRichTextValue(null, "Existing description")).toEqual(
      plainTextToRichText("Existing description")
    );
    expect(resolveRichTextValue({ unsafe: true }, "Existing description")).toEqual(
      plainTextToRichText("Existing description")
    );
  });

  it("parses form JSON while keeping a synchronized plain-text projection", () => {
    const formData = new FormData();
    formData.set("descriptionRich", JSON.stringify(formattedDocument));
    const result = parseRichDescriptionInput(formData);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toContain("Section\nSubsection");
      expect(result.value.descriptionRich).toEqual(
        normalizeRichTextValue(formattedDocument)
      );
    }
  });

  it("supports legacy forms and rejects malformed structured submissions", () => {
    const legacy = new FormData();
    legacy.set("description", "Legacy prose");
    expect(parseRichDescriptionInput(legacy)).toEqual({
      ok: true,
      value: {
        description: "Legacy prose",
        descriptionRich: plainTextToRichText("Legacy prose"),
      },
    });

    const malformed = new FormData();
    malformed.set("descriptionRich", "{");
    expect(parseRichDescriptionInput(malformed)).toEqual({
      ok: false,
      error: "invalid_rich_description",
    });
  });
});
