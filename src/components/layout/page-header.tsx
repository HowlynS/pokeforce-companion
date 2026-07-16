import { designTokens } from "@/lib/design-tokens";

type PageHeaderProps = {
  title: string;
  /** Omitted entirely when a record has no description: missing content is
      not dressed up as page copy. */
  description?: string;
  /** Small label above the title (e.g. "Admin") marking which area of the
      site the page belongs to. Kept outside the h1 so the page's
      accessible heading stays exactly the title. */
  eyebrow?: string;
};

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: "12px",
        marginBottom: designTokens.layout.sectionGap,
      }}
    >
      {eyebrow ? (
        <p
          style={{
            margin: 0,
            color: designTokens.colors.accent,
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {eyebrow}
        </p>
      ) : null}

      {/* The one h1 of every page: the shell's brand lockup is not a
          heading, so the page title owns the top of the outline. */}
      <h1
        style={{
          margin: 0,
          fontSize: designTokens.typography.pageTitle,
          lineHeight: 1.1,
        }}
      >
        {title}
      </h1>

      {description ? (
        <p
          style={{
            margin: 0,
            maxWidth: "720px",
            color: designTokens.colors.textMuted,
            fontSize: "18px",
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      ) : null}
    </section>
  );
}
