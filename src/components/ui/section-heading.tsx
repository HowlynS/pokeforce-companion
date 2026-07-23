import type { LucideIcon } from "lucide-react";
import { SectionIcon } from "@/components/admin/section-icon";

// Shared public detail-page section heading (Admin Full-Width Card
// Layout pass): replaces five identical copy-pasted local SectionHeading
// components (Item/Recipe/Profession/Category/Location detail pages)
// with one definition, now optionally carrying the same bare Option-B
// icon treatment admin section headings use — reusing SectionIcon
// directly rather than a public-specific fork, since its styling reads
// entirely through CSS custom properties that already resolve correctly
// outside .admin-shell (the public :root's own --color-accent is the
// same gold). icon stays optional: not every public heading needs one
// (a lone "Description" heading, for instance, gains nothing from it).
type SectionHeadingProps = {
  children: React.ReactNode;
  icon?: LucideIcon;
};

export function SectionHeading({ children, icon }: SectionHeadingProps) {
  return (
    <h2
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        margin: "0 0 16px",
        fontSize: "24px",
        lineHeight: 1.2,
      }}
    >
      {icon ? <SectionIcon icon={icon} /> : null}
      {children}
    </h2>
  );
}
