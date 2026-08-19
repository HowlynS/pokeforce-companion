import Link from "next/link";

/**
 * How much visual weight the control carries. The arrow drawing and its
 * motion are identical across variants — only outline strength, surface, and
 * size differ, so the family always reads as one control.
 */
export type PageLinkArrowVariant = "default" | "subtle" | "prominent";

type PageLinkArrowProps = {
  href: string;
  /** The control's accessible name, e.g. "Open Charcoal item page". The
      glyph itself is decorative, so this is the only thing announced. */
  label: string;
  variant?: PageLinkArrowVariant;
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
 *
 * The glyph is split into a shaft and a fixed arrowhead so the shaft can
 * extend back toward its tail on hover/focus — a short stroke resolving into
 * a full arrow. The arrowhead never moves or fades, so the resting state is
 * already unambiguously an arrow rather than a bare line. See
 * `.page-link-arrow-shaft` in globals.css; under reduced motion the shaft is
 * simply drawn at full length and nothing animates.
 */
export function PageLinkArrow({
  href,
  label,
  variant = "default",
  className,
  onClick,
}: PageLinkArrowProps) {
  const classes = [
    "page-link-arrow",
    variant !== "default" ? `page-link-arrow--${variant}` : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} aria-label={label} onClick={onClick} className={classes}>
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="page-link-arrow-shaft" d="M7 17 17 7" />
        <path className="page-link-arrow-head" d="M9 7h8v8" />
      </svg>
    </Link>
  );
}
