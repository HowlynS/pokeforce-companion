import { designTokens } from "@/lib/design-tokens";

type CardProps = {
  title: string;
  description: string;
};

export function Card({ title, description }: CardProps) {
  return (
    <article
      style={{
        border: `1px solid ${designTokens.colors.border}`,
        borderRadius: designTokens.radius.md,
        background: designTokens.colors.surface,
        padding: "24px",
      }}
    >
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
    </article>
  );
}
