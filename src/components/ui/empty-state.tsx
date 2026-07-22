import { designTokens } from "@/lib/design-tokens";

type EmptyStateProps = {
  title: string;
  description: string;
  /** Optional primary action (e.g. a create link) rendered beneath the
      description. Omitted by every pre-existing caller — fully
      backward-compatible, matching the same optional-prop pattern
      VerificationPanel's own `readOnly` addition already established. */
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
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

      {action ? <div className="empty-state-action">{action}</div> : null}
    </section>
  );
}
