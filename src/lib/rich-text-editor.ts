import {
  isSafeRichTextHref,
  normalizeRichTextValue,
  resolveRichTextValue,
  serializeRichTextValue,
  type RichTextDocument,
  type RichTextValue,
} from "@/lib/rich-text";

type EditorMark = {
  type?: unknown;
  attrs?: unknown;
};

type EditorNode = {
  type?: unknown;
  text?: unknown;
  attrs?: unknown;
  marks?: unknown;
  content?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeMarks(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const marks = value.flatMap((candidate: EditorMark) => {
    if (!isRecord(candidate) || typeof candidate.type !== "string") {
      return [];
    }
    if (["bold", "italic", "underline"].includes(candidate.type)) {
      return [{ type: candidate.type }];
    }
    if (
      candidate.type === "link" &&
      isRecord(candidate.attrs) &&
      typeof candidate.attrs.href === "string" &&
      isSafeRichTextHref(candidate.attrs.href)
    ) {
      return [
        {
          type: "link",
          attrs: { href: candidate.attrs.href.trim() },
        },
      ];
    }
    return [];
  });

  return marks.length > 0 ? marks : undefined;
}

function sanitizeInlineNode(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "hardBreak") {
    return { type: "hardBreak" };
  }
  if (value.type !== "text" || typeof value.text !== "string") {
    return null;
  }
  const marks = sanitizeMarks(value.marks);
  return {
    type: "text",
    text: value.text,
    ...(marks ? { marks } : {}),
  };
}

function sanitizeInlineContent(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const content = value
    .map(sanitizeInlineNode)
    .filter((node): node is Record<string, unknown> => node !== null);
  return content.length > 0 ? content : undefined;
}

function sanitizeBlockNode(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "paragraph") {
    const content = sanitizeInlineContent(value.content);
    return { type: "paragraph", ...(content ? { content } : {}) };
  }

  if (value.type === "heading") {
    const level =
      isRecord(value.attrs) && (value.attrs.level === 2 || value.attrs.level === 3)
        ? value.attrs.level
        : null;
    const content = sanitizeInlineContent(value.content);
    return level
      ? {
          type: "heading",
          attrs: { level },
          ...(content ? { content } : {}),
        }
      : { type: "paragraph", ...(content ? { content } : {}) };
  }

  if (value.type === "bulletList" && Array.isArray(value.content)) {
    const items = value.content.flatMap((rawItem: EditorNode) => {
      if (
        !isRecord(rawItem) ||
        rawItem.type !== "listItem" ||
        !Array.isArray(rawItem.content)
      ) {
        return [];
      }
      const content = rawItem.content
        .map(sanitizeBlockNode)
        .filter(
          (node): node is Record<string, unknown> =>
            node !== null &&
            (node.type === "paragraph" || node.type === "bulletList")
        );
      return content.length > 0 ? [{ type: "listItem", content }] : [];
    });
    return items.length > 0 ? { type: "bulletList", content: items } : null;
  }

  return null;
}

/**
 * Reduces editor/pasted JSON to the same deliberately small schema accepted
 * by the server. Unsupported nodes and marks are discarded; unsafe link marks
 * become ordinary text. The canonical validator still runs last and remains
 * the authoritative size/depth/shape boundary.
 */
export function sanitizeEditorDocument(value: unknown): RichTextValue | null {
  if (!isRecord(value) || value.type !== "doc") {
    return null;
  }
  const content = Array.isArray(value.content)
    ? value.content
        .map(sanitizeBlockNode)
        .filter((node): node is Record<string, unknown> => node !== null)
    : [];

  return normalizeRichTextValue({
    version: 1,
    doc: {
      type: "doc",
      ...(content.length > 0 ? { content } : {}),
    },
  });
}

export function editorDocumentFromValue(
  richValue: unknown,
  legacyDescription?: string | null
): RichTextDocument {
  return (
    resolveRichTextValue(richValue, legacyDescription)?.doc ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    }
  );
}

export function serializeEditorDocument(value: unknown): string {
  return serializeRichTextValue(sanitizeEditorDocument(value));
}
