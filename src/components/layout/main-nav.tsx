import { designTokens } from "@/lib/design-tokens";

const navItems = [
  { label: "Items", href: "/items" },
  { label: "Recipes", href: "/recipes" },
  { label: "Professions", href: "/professions" },
  { label: "Categories", href: "/categories" },
];

export function MainNav() {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          style={{
            border: `1px solid ${designTokens.colors.border}`,
            borderRadius: designTokens.radius.sm,
            color: designTokens.colors.text,
            padding: "8px 12px",
            textDecoration: "none",
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
