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
