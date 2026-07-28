import { describe, expect, it } from "vitest";
import {
  editorDocumentFromValue,
  sanitizeEditorDocument,
  serializeEditorDocument,
} from "@/lib/rich-text-editor";

describe("rich-text editor document boundary", () => {
  it("preserves the supported WYSIWYG subset deterministically", () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, class: "pasted-class" },
          content: [
            {
              type: "text",
              text: "Heading",
              marks: [
                { type: "underline", attrs: { style: "color:red" } },
                { type: "bold" },
              ],
            },
          ],
        },
        {
          type: "bulletList",
          attrs: { class: "foreign-list" },
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
    };

    expect(serializeEditorDocument(document)).toBe(
      JSON.stringify(sanitizeEditorDocument(document))
    );
    expect(sanitizeEditorDocument(document)).toEqual({
      version: 1,
      doc: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [
              {
                type: "text",
                text: "Heading",
                marks: [{ type: "bold" }, { type: "underline" }],
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
    });
  });

  it("strips unsupported pasted nodes, styles, and unsafe links", () => {
    expect(
      sanitizeEditorDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Safe text",
                marks: [
                  { type: "textStyle", attrs: { color: "red" } },
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
              { type: "image", attrs: { src: "data:image/png;base64,abc" } },
            ],
          },
          { type: "table", content: [] },
        ],
      })
    ).toEqual({
      version: 1,
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Safe text" }],
          },
        ],
      },
    });
  });

  it("never preserves admin destinations in authored public content", () => {
    expect(
      sanitizeEditorDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Private editor",
                marks: [{ type: "link", attrs: { href: "/admin/items" } }],
              },
            ],
          },
        ],
      })
    ).toEqual({
      version: 1,
      doc: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Private editor" }],
          },
        ],
      },
    });
  });

  it("allows canonical internal and secure external links only", () => {
    expect(
      sanitizeEditorDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Item",
                marks: [{ type: "link", attrs: { href: "/items/iron-bar" } }],
              },
              {
                type: "text",
                text: " Guide",
                marks: [
                  { type: "link", attrs: { href: "https://example.com/guide" } },
                ],
              },
            ],
          },
        ],
      })?.doc.content?.[0]
    ).toMatchObject({
      content: [
        { marks: [{ type: "link", attrs: { href: "/items/iron-bar" } }] },
        {
          marks: [
            { type: "link", attrs: { href: "https://example.com/guide" } },
          ],
        },
      ],
    });
  });

  it("normalizes visually empty editor documents", () => {
    expect(
      sanitizeEditorDocument({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "  " }] }],
      })
    ).toBeNull();
    expect(serializeEditorDocument({ type: "doc" })).toBe("");
  });

  it("preserves legacy text and line breaks as editor paragraphs", () => {
    expect(editorDocumentFromValue(null, "First line\nSecond line")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First line" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second line" }] },
      ],
    });
  });
});
