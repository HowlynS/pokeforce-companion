import Link from "next/link";
import { Fragment } from "react";
import type {
  RichTextBlockNode,
  RichTextMark,
  RichTextTextNode,
} from "@/lib/rich-text";
import { resolveRichTextValue } from "@/lib/rich-text";

type RichTextContentProps = {
  value: unknown;
  fallback?: string | null;
  className?: string;
};

function renderMarkedText(node: RichTextTextNode, key: string) {
  let content: React.ReactNode = node.text;

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") {
      content = <strong>{content}</strong>;
    } else if (mark.type === "italic") {
      content = <em>{content}</em>;
    } else if (mark.type === "underline") {
      content = <u>{content}</u>;
    } else {
      content = renderLink(mark, content);
    }
  }
  return <Fragment key={key}>{content}</Fragment>;
}

function renderLink(mark: Extract<RichTextMark, { type: "link" }>, content: React.ReactNode) {
  const href = mark.attrs.href;
  return href.startsWith("/") ? (
    <Link href={href}>{content}</Link>
  ) : (
    <a href={href} rel="noopener noreferrer">
      {content}
    </a>
  );
}

function renderInline(
  content: Exclude<RichTextBlockNode, { type: "bulletList" }>["content"]
) {
  return content?.map((node, index) =>
    node.type === "hardBreak" ? (
      <br key={`break-${index}`} />
    ) : (
      renderMarkedText(node, `text-${index}`)
    )
  );
}

function renderBlock(block: RichTextBlockNode, key: string): React.ReactNode {
  if (block.type === "paragraph") {
    return <p key={key}>{renderInline(block.content)}</p>;
  }
  if (block.type === "heading") {
    return block.attrs.level === 2 ? (
      <h2 key={key}>{renderInline(block.content)}</h2>
    ) : (
      <h3 key={key}>{renderInline(block.content)}</h3>
    );
  }
  return (
    <ul key={key}>
      {block.content.map((item, itemIndex) => (
        <li key={`${key}-item-${itemIndex}`}>
          {item.content.map((child, childIndex) =>
            renderBlock(child, `${key}-item-${itemIndex}-${childIndex}`)
          )}
        </li>
      ))}
    </ul>
  );
}

export function RichTextContent({
  value,
  fallback,
  className = "rich-text-content",
}: RichTextContentProps) {
  const normalized = resolveRichTextValue(value, fallback);

  if (!normalized) {
    return null;
  }

  return (
    <div className={className}>
      {(normalized.doc.content ?? []).map((block, index) =>
        renderBlock(block, `block-${index}`)
      )}
    </div>
  );
}
