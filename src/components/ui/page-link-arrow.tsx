import Link from "next/link";

/**
 * How much visual weight the control carries. The arrow drawing and its
 * motion are identical across variants — only outline strength, surface,
 * stroke weight and size differ, so the family always reads as one control.
 *
 * `quiet` is the weight for a heading that is ALREADY the loudest thing on
 * its row (the Locations directory's Region headings): the affordance has to
 * be findable without competing with the region name beside it. It keeps a
 * real resting outline — unlike `subtle`, which drops its frame entirely and
 * would disappear against a large heading — but draws that outline and the
 * glyph itself more lightly than `default`.
 */
export type PageLinkArrowVariant =
  | "default"
  | "quiet"
  | "subtle"
  | "prominent";

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
 * always navigates to another record's page, and reads that way: a diagonal
 * up-right arrow in a gold-outlined square. Every public surface that offers
 * this exact affordance uses this one component, so the treatment can never
 * drift apart per page.
 *
 * The glyph draws a complete, static up-right arrow at rest (never a bare
 * line) and, on hover/focus, plays a looping "depart & return" motion: the
 * whole glyph flies out through the top-right corner, fades, silently resets
 * to the bottom-left, and flies back in. See `.page-link-arrow-glyph` and the
 * `page-link-arrow-depart` keyframes in globals.css; under reduced motion the
 * glyph simply stays put and only the surrounding box's colors respond.
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
        className="page-link-arrow-glyph"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 17 17 7" />
        <path d="M17 7h-7" />
        <path d="M17 7v7" />
      </svg>
    </Link>
  );
}
