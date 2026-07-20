// Shared dashboard resource summary card (Slice 9G.1): resource name,
// total record count, optional concise supporting context, and a single
// direct link to the resource's own workspace. The whole card is ONE
// anchor — mirroring the existing Card component's own linked-card
// pattern — never a click handler masquerading as a link, so ordinary
// keyboard/anchor navigation always works. Uses the gold accent that
// styles the rest of the admin shell (the purple admin-accent is scoped
// to editor chrome only, never the dashboard).

import { designTokens } from "@/lib/design-tokens";

type DashboardSummaryCardProps = {
  title: string;
  href: string;
  count: number;
  /** The count's own unit word, already pluralized by the caller (e.g.
      "items", "location") — zero and one both render normally; zero is
      itself meaningful and is never hidden. */
  unitLabel: string;
  /** Optional single line of supporting context (e.g. a related count);
      omitted entirely for resources with nothing meaningful to add — no
      empty wrapper renders when absent. */
  context?: string;
};

export function DashboardSummaryCard({
  title,
  href,
  count,
  unitLabel,
  context,
}: DashboardSummaryCardProps) {
  return (
    <a
      href={href}
      className="interactive-card"
      style={{
        border: `1px solid ${designTokens.colors.border}`,
        borderRadius: designTokens.radius.md,
        background: designTokens.colors.surface,
        color: designTokens.colors.text,
        display: "block",
        padding: "24px",
        textDecoration: "none",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: designTokens.typography.cardTitle,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: designTokens.colors.accent,
          fontSize: "32px",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {count}
      </p>

      <p
        style={{
          margin: "4px 0 0",
          color: designTokens.colors.textMuted,
          fontSize: "14px",
        }}
      >
        {unitLabel}
      </p>

      {context ? (
        <p
          style={{
            margin: "12px 0 0",
            paddingTop: "12px",
            borderTop: `1px solid ${designTokens.colors.border}`,
            color: designTokens.colors.textMuted,
            fontSize: "14px",
          }}
        >
          {context}
        </p>
      ) : null}
    </a>
  );
}
