import { designTokens } from "@/lib/design-tokens";

type CardProps = {
  title: string;
  description: string;
  href?: string;
};

export function Card({ title, description, href }: CardProps) {
  const cardContent = (
    <>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: "22px",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: designTokens.colors.textMuted,
          fontSize: "16px",
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </>
  );

  const cardStyles = {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: designTokens.radius.md,
    background: designTokens.colors.surface,
    color: designTokens.colors.text,
    display: "block",
    padding: "24px",
    textDecoration: "none",
  };

  if (href) {
    return (
      <a href={href} style={cardStyles}>
        {cardContent}
      </a>
    );
  }

  return <article style={cardStyles}>{cardContent}</article>;
}
