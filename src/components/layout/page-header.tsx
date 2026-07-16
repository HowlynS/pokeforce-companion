import { designTokens } from "@/lib/design-tokens";

type PageHeaderProps = {
  title: string;
  /** Omitted entirely when a record has no description: missing content is
      not dressed up as page copy. */
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: "12px",
        marginBottom: designTokens.layout.sectionGap,
      }}
    >
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
