// The ONE classification rule for a record's gameplay-verification state,
// shared by the admin editor primitives (Slice 9B.2). Pure — no React, no
// database — so the rule the verification panel renders is unit-testable
// on its own. Purely presentational: the server-side stamping rules in
// src/lib/game-versions.ts are untouched by this module.

export type VerificationStatus = "unverified" | "current" | "outdated";

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  current: "Verified — current version",
  outdated: "Verified — older version",
};

/**
 * Classifies a record's verification stamp against the current Game
 * Version. A record with no complete stamp is "unverified". A stamped
 * record is "current" only when its version IS the version marked
 * current; anything else — including the state where no version is
 * current at all — is "outdated", because the stamp provably does not
 * refer to the current version.
 */
export function classifyVerificationStatus(input: {
  verifiedAt: Date | null;
  verifiedGameVersionId: string | null;
  currentGameVersionId: string | null;
}): VerificationStatus {
  if (!input.verifiedAt || !input.verifiedGameVersionId) {
    return "unverified";
  }

  if (
    input.currentGameVersionId !== null &&
    input.verifiedGameVersionId === input.currentGameVersionId
  ) {
    return "current";
  }

  return "outdated";
}
