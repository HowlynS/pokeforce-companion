import { describe, expect, it } from "vitest";
import {
  VERIFICATION_STATUS_LABELS,
  classifyVerificationStatus,
} from "@/lib/admin/verification-status";

const STAMPED_AT = new Date("2026-07-17T00:00:00.000Z");

describe("classifyVerificationStatus", () => {
  it("classifies a record with no stamp as unverified", () => {
    expect(
      classifyVerificationStatus({
        verifiedAt: null,
        verifiedGameVersionId: null,
        currentGameVersionId: "v-current",
      })
    ).toBe("unverified");
  });

  it("treats a half-populated stamp as unverified rather than guessing", () => {
    expect(
      classifyVerificationStatus({
        verifiedAt: STAMPED_AT,
        verifiedGameVersionId: null,
        currentGameVersionId: "v-current",
      })
    ).toBe("unverified");

    expect(
      classifyVerificationStatus({
        verifiedAt: null,
        verifiedGameVersionId: "v-current",
        currentGameVersionId: "v-current",
      })
    ).toBe("unverified");
  });

  it("classifies a stamp for the current version as current", () => {
    expect(
      classifyVerificationStatus({
        verifiedAt: STAMPED_AT,
        verifiedGameVersionId: "v-current",
        currentGameVersionId: "v-current",
      })
    ).toBe("current");
  });

  it("classifies a stamp for a different version as outdated", () => {
    expect(
      classifyVerificationStatus({
        verifiedAt: STAMPED_AT,
        verifiedGameVersionId: "v-older",
        currentGameVersionId: "v-current",
      })
    ).toBe("outdated");
  });

  it("classifies a stamped record as outdated when no version is current", () => {
    expect(
      classifyVerificationStatus({
        verifiedAt: STAMPED_AT,
        verifiedGameVersionId: "v-older",
        currentGameVersionId: null,
      })
    ).toBe("outdated");
  });

  it("labels every status with contributor-facing wording", () => {
    expect(VERIFICATION_STATUS_LABELS.unverified).toBe("Unverified");
    expect(VERIFICATION_STATUS_LABELS.current).toBe(
      "Verified — current version"
    );
    expect(VERIFICATION_STATUS_LABELS.outdated).toBe(
      "Verified — older version"
    );
  });
});
