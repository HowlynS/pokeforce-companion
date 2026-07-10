import { designTokens } from "@/lib/design-tokens";

type ContentGridProps = {
  children: React.ReactNode;
};

export function ContentGrid({ children }: ContentGridProps) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: designTokens.layout.sectionGap,
      }}
    >
      {children}
    </section>
  );
}
