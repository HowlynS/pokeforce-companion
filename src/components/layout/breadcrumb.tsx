import Link from "next/link";

type BreadcrumbSegment = {
  name: string;
  href: string;
};

type BreadcrumbProps = {
  /** Every segment before the current page, root first (e.g. Home, then
      the directory). Each renders as a real link. */
  segments: readonly BreadcrumbSegment[];
  /** The current page's own name. Rendered last, as plain text with
      aria-current="page" — never a link, matching the "current page is
      never itself a link" convention already used by the admin nav and
      the existing per-page breadcrumbs (e.g. LocationBreadcrumb). */
  current: string;
};

/**
 * Shared public breadcrumb primitive (Claude Design redesign, Slice 1).
 *
 * Reuses the existing `.public-breadcrumb` / `.breadcrumb-link` classes
 * (globals.css) that the per-page breadcrumbs on Item/Recipe/Profession/
 * Class/Shop/Location detail pages already established — this component
 * does not introduce a second visual system, it factors the identical
 * markup those pages already duplicate into one place. Wiring existing
 * detail pages over to this component happens per-resource in their own
 * later slice, not here.
 */
export function Breadcrumb({ segments, current }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="public-breadcrumb">
      <ol>
        {segments.map((segment, index) => (
          <li key={segment.href}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            <Link href={segment.href} className="breadcrumb-link">
              {segment.name}
            </Link>
          </li>
        ))}
        <li>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{current}</span>
        </li>
      </ol>
    </nav>
  );
}
