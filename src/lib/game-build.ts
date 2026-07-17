import "server-only";

// This reads a private (non-NEXT_PUBLIC_) environment variable and must
// never be exposed to the browser — verification stamps always come from
// the server's trusted value, never from client input. The "server-only"
// import turns an accidental client-bundle import into a build error
// rather than relying solely on convention.

/**
 * Returns the current game build identifier used when an admin marks
 * gameplay data as verified. Fails loudly on a missing or blank value so a
 * misconfigured environment can never silently stamp records with an empty
 * build id.
 */
export function getCurrentGameBuildId(): string {
  const value = (process.env.CURRENT_GAME_BUILD_ID ?? "").trim();

  if (value === "") {
    throw new Error(
      "CURRENT_GAME_BUILD_ID is not configured. Set it in the server environment before marking gameplay data as verified."
    );
  }

  return value;
}
