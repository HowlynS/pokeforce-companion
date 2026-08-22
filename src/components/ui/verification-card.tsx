import { formatDisplayDate, type FormattableDate } from "@/lib/format-date";
import {
  PUBLIC_VERIFICATION_STATE_LABELS,
  PUBLIC_VERIFICATION_STATE_NOTES,
  resolvePublicVerificationState,
  type PublicVerificationStamp,
} from "@/lib/public-verification";

type VerificationCardProps = {
  stamp: PublicVerificationStamp;
  /** The canonical current Game Version's name, from `getCurrentGameVersion`.
      Never a second source of truth: the page reads the row marked
      `isCurrent` and hands the name down. */
  currentGameVersionName: string | null;
  /** The record's own last-changed timestamp. This card is the ONE public
      home for it — no page shows the date a second time. */
  updatedAt?: FormattableDate;
  /** Extra classes from the surrounding surface -- typically a placement
      modifier, so the card sits correctly in whichever slot its page has. */
  className?: string;
};

/**
 * Verified-information card for a public resource detail page.
 *
 * This is structured detail information, not a floating badge. Where a page
 * already has an information sidebar (Item, Location) it is the last panel in
 * that column, directly under the resource's own Details panel and sharing
 * its width, alignment, stack gap and responsive collapse. Where a page has
 * no sidebar (Recipe, Profession, Class, Shop) it sits near the TOP of the
 * page's content instead — one predictable slot per page type, so
 * verification never wanders and never depends on a hover to be found.
 *
 * It is a plain server component with no interactive reveal: everything it
 * has to say is already on screen. Only fields the record actually carries
 * are rendered; an incomplete stamp reads as Unverified rather than
 * inventing a build or a date.
 */
export function VerificationCard({
  stamp,
  currentGameVersionName,
  updatedAt,
  className,
}: VerificationCardProps) {
  const state = resolvePublicVerificationState(stamp, currentGameVersionName);
  const verifiedDate = formatDisplayDate(stamp.verifiedAt);
  const updatedDate = formatDisplayDate(updatedAt);
  // Only a real, complete stamp names a build. An unverified record shows no
  // build badge at all rather than a placeholder one.
  const buildName =
    state === "unverified" ? null : (stamp.verifiedGameVersion?.name ?? null);

  const classes = [
    "public-verification-card",
    `public-verification-card--${state}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} aria-labelledby="verification-card-title">
      <h2 id="verification-card-title" className="public-panel-title">
        Verified information
      </h2>

      <dl className="public-verification-card-facts">
        <div>
          <dt>Status</dt>
          <dd>
            <span
              className={`public-status-badge public-status-badge--${state}`}
            >
              {PUBLIC_VERIFICATION_STATE_LABELS[state]}
            </span>
          </dd>
        </div>

        {buildName ? (
          <div>
            <dt>Build</dt>
            <dd>
              <span
                className={`public-status-badge public-status-badge--${state}`}
              >
                {buildName}
              </span>
            </dd>
          </div>
        ) : null}

        {verifiedDate ? (
          <div>
            <dt>Checked on</dt>
            <dd>{verifiedDate}</dd>
          </div>
        ) : null}

        {updatedDate ? (
          <div>
            <dt>Last updated</dt>
            <dd>{updatedDate}</dd>
          </div>
        ) : null}
      </dl>

      <p className="public-verification-card-note">
        {PUBLIC_VERIFICATION_STATE_NOTES[state]}
      </p>
    </section>
  );
}
