import { formatDisplayDate, type FormattableDate } from "@/lib/format-date";

export type PublicVerificationStamp = {
  verifiedAt: FormattableDate;
  verifiedGameVersion: { name: string } | null;
};

/**
 * Restrained public verification copy. Incomplete stamps are hidden rather
 * than guessed, preserving the site's universal hide-empty behavior.
 */
export function formatPublicVerification(
  stamp: PublicVerificationStamp
): string | null {
  if (!stamp.verifiedGameVersion) {
    return null;
  }

  const verifiedDate = formatDisplayDate(stamp.verifiedAt);
  if (!verifiedDate) {
    return null;
  }

  return `Verified for ${stamp.verifiedGameVersion.name} on ${verifiedDate}`;
}

/**
 * The three states a visitor can see, derived from the record's own stamp
 * and the ONE canonical current Game Version (the row marked `isCurrent`,
 * read through `getCurrentGameVersion` — never a second source of truth).
 *
 * - `verified`   — checked against the version that is current right now.
 * - `outdated`   — checked, but against an older version.
 * - `unverified` — never checked, or the stamp is incomplete.
 */
export type PublicVerificationState = "verified" | "outdated" | "unverified";

/**
 * Classifies a public verification stamp.
 *
 * An incomplete stamp (no version, or no usable date) reads as `unverified`
 * rather than inventing a build or a date — the same hide-empty rule
 * `formatPublicVerification` already applies.
 *
 * Versions are compared by NAME because that is the only field the public
 * detail queries select, and `GameVersion.name` is unique in the schema, so
 * a name identifies a version exactly as well as its id would. This keeps
 * the comparison free of any query change and free of any id reaching a
 * public page.
 *
 * When no current version is configured at all, a stamped record is
 * `outdated` rather than `verified`: the site cannot claim a record matches
 * "the current build" when it does not know what the current build is.
 */
export function resolvePublicVerificationState(
  stamp: PublicVerificationStamp,
  currentGameVersionName: string | null
): PublicVerificationState {
  if (!stamp.verifiedGameVersion || !formatDisplayDate(stamp.verifiedAt)) {
    return "unverified";
  }

  return stamp.verifiedGameVersion.name === currentGameVersionName
    ? "verified"
    : "outdated";
}

/** The badge label shown for each state. Player-facing words only. */
export const PUBLIC_VERIFICATION_STATE_LABELS: Record<
  PublicVerificationState,
  string
> = {
  verified: "Verified",
  outdated: "Outdated",
  unverified: "Unverified",
};

/**
 * The one-sentence explanation under the badges. Deliberately free of
 * database vocabulary — no foreign keys, enum names, or "stale revision".
 */
export const PUBLIC_VERIFICATION_STATE_NOTES: Record<
  PublicVerificationState,
  string
> = {
  verified: "Gameplay data checked for the current build.",
  outdated:
    "Last verified for an older build. This gameplay data may have changed.",
  unverified:
    "This gameplay data has not been verified for the current build.",
};
