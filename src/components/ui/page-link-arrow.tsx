import Link from "next/link";

type PageLinkArrowProps = {
  href: string;
  /** The control's accessible name, e.g. "Open Charcoal item page". The
      glyph itself is decorative, so this is the only thing announced. */
  label: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

/**
 * The canonical "open the full page for this record" control.
 *
 * This is deliberately NOT a disclosure control. A disclosure chevron opens
 * and closes content in place and keeps its own muted styling; this arrow
 * always navigates to another record's page, and reads that way: an outward
 * arrow in a gold-outlined square. Every public surface that offers this
 * exact affordance uses this one component, so the treatment can never drift
 * apart per page.
 */
export function PageLinkArrow({
  href,
  label,
  className,
  onClick,
}: PageLinkArrowProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      onClick={onClick}
      className={className ? `page-link-arrow ${className}` : "page-link-arrow"}
    >
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
        <path
          d="M7 17 17 7M9 7h8v8"
          stroke="currentColor"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
