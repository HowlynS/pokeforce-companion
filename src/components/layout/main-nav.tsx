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
          className="nav-pill"
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

      {/* Compact global search: a plain GET form to /search, so it works
          without client JavaScript and wraps with the nav links on small
          screens. The full form lives on the /search page itself; the
          aria-label keeps the two search landmarks distinguishable. */}
      <form
        action="/search"
        method="get"
        role="search"
        aria-label="Site search"
        style={{ display: "flex", gap: "8px" }}
      >
        <input
          type="search"
          name="q"
          aria-label="Search query"
          placeholder="Search..."
          style={{
            border: `1px solid ${designTokens.colors.border}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surface,
            color: designTokens.colors.text,
            padding: "8px 12px",
            fontSize: "16px",
            fontFamily: "inherit",
            width: "140px",
          }}
        />
        {/* Filled accent button: clearly a form control, not another nav
            link. */}
        <button type="submit" className="btn btn-primary btn-compact">
          Search
        </button>
      </form>
    </nav>
  );
}
