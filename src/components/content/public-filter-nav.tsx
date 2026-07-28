import Link from "next/link";

type PublicFilterOption = {
  label: string;
  href: string;
  active: boolean;
};

type PublicFilterNavProps = {
  label: string;
  options: PublicFilterOption[];
};

export function PublicFilterNav({
  label,
  options,
}: PublicFilterNavProps) {
  return (
    <nav className="public-filter-nav" aria-label={label}>
      <ul>
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              aria-current={option.active ? "page" : undefined}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
