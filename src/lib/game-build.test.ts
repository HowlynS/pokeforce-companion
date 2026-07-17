// Unit coverage for the server-only current-build helper: the returned
// value is always the trimmed environment value, and a missing or blank
// configuration fails loudly instead of stamping records with "".

import { afterEach, describe, expect, it } from "vitest";
import { getCurrentGameBuildId } from "./game-build";

const ORIGINAL_VALUE = process.env.CURRENT_GAME_BUILD_ID;

afterEach(() => {
  if (ORIGINAL_VALUE === undefined) {
    delete process.env.CURRENT_GAME_BUILD_ID;
  } else {
    process.env.CURRENT_GAME_BUILD_ID = ORIGINAL_VALUE;
  }
});

describe("getCurrentGameBuildId", () => {
  it("returns the configured build id", () => {
    process.env.CURRENT_GAME_BUILD_ID = "build-42";
    expect(getCurrentGameBuildId()).toBe("build-42");
  });

  it("trims surrounding whitespace", () => {
    process.env.CURRENT_GAME_BUILD_ID = "  build-42  ";
    expect(getCurrentGameBuildId()).toBe("build-42");
  });

  it("throws when the variable is missing", () => {
    delete process.env.CURRENT_GAME_BUILD_ID;
    expect(() => getCurrentGameBuildId()).toThrow(
      "CURRENT_GAME_BUILD_ID is not configured"
    );
  });

  it("throws when the variable is blank", () => {
    process.env.CURRENT_GAME_BUILD_ID = "   ";
    expect(() => getCurrentGameBuildId()).toThrow(
      "CURRENT_GAME_BUILD_ID is not configured"
    );
  });
});
