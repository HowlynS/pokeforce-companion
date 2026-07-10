import { designTokens } from "@/lib/design-tokens";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section
      style={{
        border: `1px dashed ${designTokens.colors.border}`,
        borderRadius: designTokens.radius.lg,
        background: designTokens.colors.surfaceSoft,
        padding: "32px",
        textAlign: "center",
      }}
    >
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: "24px",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: "0 auto",
          maxWidth: "560px",
          color: designTokens.colors.textMuted,
          fontSize: "16px",
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </section>
  );
}
