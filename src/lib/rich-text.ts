const MAX_SERIALIZED_LENGTH = 60_000;
const MAX_TEXT_LENGTH = 20_000;
const MAX_NODE_COUNT = 1_000;
const MAX_DEPTH = 24;

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; attrs: { href: string } };

export type RichTextTextNode = {
  type: "text";
  text: string;
  marks?: RichTextMark[];
};

export type RichTextHardBreakNode = { type: "hardBreak" };

export type RichTextParagraphNode = {
  type: "paragraph";
  content?: Array<RichTextTextNode | RichTextHardBreakNode>;
};

export type RichTextHeadingNode = {
  type: "heading";
  attrs: { level: 2 | 3 };
  content?: Array<RichTextTextNode | RichTextHardBreakNode>;
};

export type RichTextListItemNode = {
  type: "listItem";
  content: Array<RichTextParagraphNode | RichTextBulletListNode>;
};

export type RichTextBulletListNode = {
  type: "bulletList";
  content: RichTextListItemNode[];
};

export type RichTextBlockNode =
  | RichTextParagraphNode
  | RichTextHeadingNode
  | RichTextBulletListNode;

export type RichTextDocument = {
  type: "doc";
  content?: RichTextBlockNode[];
};

export type RichTextValue = {
  version: 1;
  doc: RichTextDocument;
};

export type RichDescriptionInput = {
  description: string | null;
  descriptionRich: RichTextValue | null;
};

export type RichDescriptionParseResult =
  | { ok: true; value: RichDescriptionInput }
  | { ok: false; error: "invalid_rich_description" };

type ValidationState = {
  nodes: number;
  textLength: number;
};

const MARK_ORDER = new Map([
  ["bold", 0],
  ["italic", 1],
  ["underline", 2],
  ["link", 3],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function isSafeRichTextHref(href: string): boolean {
  const value = href.trim();

  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return true;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function parseMarks(value: unknown): RichTextMark[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > 4) {
    throw new Error("Invalid rich-text marks");
  }

  const marks: RichTextMark[] = [];
  const seen = new Set<string>();

  for (const rawMark of value) {
    if (!isRecord(rawMark) || typeof rawMark.type !== "string") {
      throw new Error("Invalid rich-text mark");
    }
    if (seen.has(rawMark.type)) {
      throw new Error("Duplicate rich-text mark");
    }
    seen.add(rawMark.type);

    if (["bold", "italic", "underline"].includes(rawMark.type)) {
      if (!hasOnlyKeys(rawMark, ["type"])) {
        throw new Error("Unsupported rich-text mark attributes");
      }
      marks.push({ type: rawMark.type as "bold" | "italic" | "underline" });
      continue;
    }

    if (rawMark.type === "link") {
      if (
        !hasOnlyKeys(rawMark, ["type", "attrs"]) ||
        !isRecord(rawMark.attrs) ||
        !hasOnlyKeys(rawMark.attrs, ["href"]) ||
        typeof rawMark.attrs.href !== "string" ||
        !isSafeRichTextHref(rawMark.attrs.href)
      ) {
        throw new Error("Unsafe rich-text link");
      }
      marks.push({
        type: "link",
        attrs: { href: rawMark.attrs.href.trim() },
      });
      continue;
    }

    throw new Error("Unsupported rich-text mark");
  }

  marks.sort(
    (a, b) => (MARK_ORDER.get(a.type) ?? 99) - (MARK_ORDER.get(b.type) ?? 99)
  );
  return marks.length > 0 ? marks : undefined;
}

function countNode(state: ValidationState, depth: number) {
  state.nodes += 1;
  if (state.nodes > MAX_NODE_COUNT || depth > MAX_DEPTH) {
    throw new Error("Rich-text document is too complex");
  }
}

function parseInlineNode(
  value: unknown,
  state: ValidationState,
  depth: number
): RichTextTextNode | RichTextHardBreakNode | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Invalid rich-text inline node");
  }
  countNode(state, depth);

  if (value.type === "hardBreak") {
    if (!hasOnlyKeys(value, ["type"])) {
      throw new Error("Unsupported hard-break attributes");
    }
    return { type: "hardBreak" };
  }

  if (
    value.type !== "text" ||
    !hasOnlyKeys(value, ["type", "text", "marks"]) ||
    typeof value.text !== "string"
  ) {
    throw new Error("Unsupported rich-text inline node");
  }

  if (value.text.length === 0) {
    return null;
  }
  state.textLength += value.text.length;
  if (state.textLength > MAX_TEXT_LENGTH) {
    throw new Error("Rich-text document is too long");
  }

  const marks = parseMarks(value.marks);
  return {
    type: "text",
    text: value.text,
    ...(marks ? { marks } : {}),
  };
}

function parseInlineContent(
  value: unknown,
  state: ValidationState,
  depth: number
): Array<RichTextTextNode | RichTextHardBreakNode> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("Invalid rich-text inline content");
  }
  const content = value
    .map((node) => parseInlineNode(node, state, depth + 1))
    .filter(
      (node): node is RichTextTextNode | RichTextHardBreakNode => node !== null
    );
  return content.length > 0 ? content : undefined;
}

function parseParagraph(
  value: Record<string, unknown>,
  state: ValidationState,
  depth: number
): RichTextParagraphNode {
  if (!hasOnlyKeys(value, ["type", "content"])) {
    throw new Error("Unsupported paragraph attributes");
  }
  const content = parseInlineContent(value.content, state, depth);
  return { type: "paragraph", ...(content ? { content } : {}) };
}

function parseBulletList(
  value: Record<string, unknown>,
  state: ValidationState,
  depth: number
): RichTextBulletListNode {
  if (
    !hasOnlyKeys(value, ["type", "content"]) ||
    !Array.isArray(value.content) ||
    value.content.length === 0
  ) {
    throw new Error("Invalid bullet list");
  }

  const content = value.content.map((rawItem) => {
    if (
      !isRecord(rawItem) ||
      rawItem.type !== "listItem" ||
      !hasOnlyKeys(rawItem, ["type", "content"]) ||
      !Array.isArray(rawItem.content) ||
      rawItem.content.length === 0
    ) {
      throw new Error("Invalid list item");
    }
    countNode(state, depth + 1);
    const itemContent = rawItem.content.map((rawChild) => {
      if (!isRecord(rawChild)) {
        throw new Error("Invalid list item content");
      }
      countNode(state, depth + 2);
      if (rawChild.type === "paragraph") {
        return parseParagraph(rawChild, state, depth + 2);
      }
      if (rawChild.type === "bulletList") {
        return parseBulletList(rawChild, state, depth + 2);
      }
      throw new Error("Unsupported list item content");
    });
    return { type: "listItem" as const, content: itemContent };
  });

  return { type: "bulletList", content };
}

function parseBlockNode(
  value: unknown,
  state: ValidationState,
  depth: number
): RichTextBlockNode {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Invalid rich-text block");
  }
  countNode(state, depth);

  if (value.type === "paragraph") {
    return parseParagraph(value, state, depth);
  }
  if (value.type === "heading") {
    if (
      !hasOnlyKeys(value, ["type", "attrs", "content"]) ||
      !isRecord(value.attrs) ||
      !hasOnlyKeys(value.attrs, ["level"]) ||
      (value.attrs.level !== 2 && value.attrs.level !== 3)
    ) {
      throw new Error("Invalid rich-text heading");
    }
    const content = parseInlineContent(value.content, state, depth);
    return {
      type: "heading",
      attrs: { level: value.attrs.level },
      ...(content ? { content } : {}),
    };
  }
  if (value.type === "bulletList") {
    return parseBulletList(value, state, depth);
  }
  throw new Error("Unsupported rich-text block");
}

function hasVisibleContent(node: RichTextDocument): boolean {
  return Boolean(
    node.content?.some((block) => {
      if (block.type === "bulletList") {
        return block.content.some((item) =>
          item.content.some((child) =>
            child.type === "bulletList"
              ? hasVisibleContent({ type: "doc", content: [child] })
              : child.content?.some(
                  (inline) =>
                    inline.type === "hardBreak" ||
                    (inline.type === "text" && inline.text.trim() !== "")
                )
          )
        );
      }
      return block.content?.some(
        (inline) =>
          inline.type === "hardBreak" ||
          (inline.type === "text" && inline.text.trim() !== "")
      );
    })
  );
}

export function normalizeRichTextValue(value: unknown): RichTextValue | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["version", "doc"]) ||
    value.version !== 1 ||
    !isRecord(value.doc) ||
    value.doc.type !== "doc" ||
    !hasOnlyKeys(value.doc, ["type", "content"]) ||
    (value.doc.content !== undefined && !Array.isArray(value.doc.content))
  ) {
    throw new Error("Invalid rich-text document");
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_SERIALIZED_LENGTH) {
    throw new Error("Rich-text document is too large");
  }

  const state: ValidationState = { nodes: 1, textLength: 0 };
  const content = (value.doc.content ?? []).map((block) =>
    parseBlockNode(block, state, 1)
  );
  const doc: RichTextDocument = {
    type: "doc",
    ...(content.length > 0 ? { content } : {}),
  };
  return hasVisibleContent(doc) ? { version: 1, doc } : null;
}

export function plainTextToRichText(value: string | null | undefined): RichTextValue | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  const content: RichTextParagraphNode[] = normalized
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    }));
  return { version: 1, doc: { type: "doc", content } };
}

function inlineText(
  content: Array<RichTextTextNode | RichTextHardBreakNode> | undefined
): string {
  return (content ?? [])
    .map((node) => (node.type === "hardBreak" ? "\n" : node.text))
    .join("");
}

function blockText(block: RichTextBlockNode): string {
  if (block.type !== "bulletList") {
    return inlineText(block.content);
  }
  return block.content
    .map((item) =>
      item.content
        .map((child) => (child.type === "bulletList" ? blockText(child) : inlineText(child.content)))
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean)
    .join("\n");
}

export function richTextToPlainText(value: RichTextValue | null): string | null {
  if (!value) {
    return null;
  }
  const text = (value.doc.content ?? []).map(blockText).join("\n").trim();
  return text || null;
}

export function resolveRichTextValue(
  richValue: unknown,
  legacyDescription?: string | null
): RichTextValue | null {
  try {
    const normalized = normalizeRichTextValue(richValue);
    return normalized ?? plainTextToRichText(legacyDescription);
  } catch {
    return plainTextToRichText(legacyDescription);
  }
}

export function serializeRichTextValue(value: RichTextValue | null): string {
  return value ? JSON.stringify(value) : "";
}

export function parseRichDescriptionInput(
  formData: FormData,
  richField = "descriptionRich",
  legacyField = "description"
): RichDescriptionParseResult {
  const rawRich = formData.get(richField);
  try {
    const descriptionRich =
      rawRich === null
        ? plainTextToRichText(String(formData.get(legacyField) ?? ""))
        : normalizeRichTextValue(
            String(rawRich).trim() ? JSON.parse(String(rawRich)) : null
          );
    return {
      ok: true,
      value: {
        description: richTextToPlainText(descriptionRich),
        descriptionRich,
      },
    };
  } catch {
    return { ok: false, error: "invalid_rich_description" };
  }
}
