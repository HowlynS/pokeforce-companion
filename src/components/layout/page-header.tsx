import { designTokens } from "@/lib/design-tokens";

type PageHeaderProps = {
  title: string;
  description: string;
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
      <h2
        style={{
          margin: 0,
          fontSize: "40px",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>

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
    </section>
  );
}
