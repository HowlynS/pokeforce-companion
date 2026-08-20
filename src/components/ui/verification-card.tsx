import { formatDisplayDate } from "@/lib/format-date";
import type { PublicVerificationStamp } from "@/lib/public-verification";

type VerificationCardProps = {
  stamp: PublicVerificationStamp;
  /** Extra classes from the surrounding surface -- typically the host
      sidebar's own panel class, so the card inherits that column's
      established panel treatment instead of inventing a second one. */
  className?: string;
};

/**
 * Verified-information card for a public resource detail page.
 *
 * This is structured detail information, not a floating badge: it renders as
 * an ordinary panel in whatever information column the page already has
 * (Item's and Location's sidebars) or, on pages with no sidebar, as the
 * closing panel of the page. That is the whole point of the pattern -- one
 * predictable place per page type, so verification never wanders around a
 * hero again and never depends on a hover to be discoverable.
 *
 * It is a plain server component with no interactive reveal: everything it
 * has to say is already on screen. Only fields the record actually carries
 * are rendered; an incomplete stamp reads as Unverified rather than
 * inventing a build or a date.
 */
export function VerificationCard({ stamp, className }: VerificationCardProps) {
  const verifiedDate = formatDisplayDate(stamp.verifiedAt);
  const isVerified = Boolean(stamp.verifiedGameVersion && verifiedDate);

  const classes = [
    "public-verification-card",
    isVerified
      ? "public-verification-card--verified"
      : "public-verification-card--unverified",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} aria-labelledby="verification-card-title">
      <h2 id="verification-card-title">Verified information</h2>

      <p className="public-verification-card-status">
        <span aria-hidden="true">{isVerified ? "✓" : "?"}</span>
        {isVerified ? "Verified" : "Unverified"}
      </p>

      {isVerified ? (
        <>
          <dl className="public-verification-card-facts">
            <div>
              <dt>Game version</dt>
              <dd>{stamp.verifiedGameVersion!.name}</dd>
            </div>
            <div>
              <dt>Checked on</dt>
              <dd>{verifiedDate}</dd>
            </div>
          </dl>
          <p className="public-verification-card-note">
            This gameplay information was checked against this build.
          </p>
        </>
      ) : (
        <p className="public-verification-card-note">
          Not verified for the current build. This gameplay data may be
          outdated.
        </p>
      )}
    </section>
  );
}
