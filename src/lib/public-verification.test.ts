import { describe, expect, it } from "vitest";
import {
  PUBLIC_VERIFICATION_STATE_LABELS,
  PUBLIC_VERIFICATION_STATE_NOTES,
  formatPublicVerification,
  resolvePublicVerificationState,
} from "@/lib/public-verification";

describe("formatPublicVerification", () => {
  it("includes the Game Version and deterministic verification date", () => {
    expect(
      formatPublicVerification({
        verifiedAt: new Date("2026-07-25T18:30:00.000Z"),
        verifiedGameVersion: { name: "Summer Update" },
      })
    ).toBe("Verified for Summer Update on 25 Jul 2026");
  });

  it("hides missing or incomplete stamps", () => {
    expect(
      formatPublicVerification({
        verifiedAt: null,
        verifiedGameVersion: { name: "Summer Update" },
      })
    ).toBeNull();
    expect(
      formatPublicVerification({
        verifiedAt: new Date("2026-07-25T18:30:00.000Z"),
        verifiedGameVersion: null,
      })
    ).toBeNull();
  });
});

describe("resolvePublicVerificationState", () => {
  const verifiedAt = new Date("2026-08-01T12:00:00.000Z");

  it("reads a record stamped against the current version as verified", () => {
    expect(
      resolvePublicVerificationState(
        { verifiedAt, verifiedGameVersion: { name: "0.8.14" } },
        "0.8.14"
      )
    ).toBe("verified");
  });

  it("reads a record stamped against an older version as outdated", () => {
    expect(
      resolvePublicVerificationState(
        { verifiedAt, verifiedGameVersion: { name: "0.8.13" } },
        "0.8.14"
      )
    ).toBe("outdated");
  });

  it("reads an unstamped record as unverified", () => {
    expect(
      resolvePublicVerificationState(
        { verifiedAt: null, verifiedGameVersion: null },
        "0.8.14"
      )
    ).toBe("unverified");
  });

  it("treats an incomplete stamp as unverified rather than inventing one", () => {
    // A version with no usable date, and a date with no version, are both
    // half a stamp -- the same hide-empty rule formatPublicVerification uses.
    expect(
      resolvePublicVerificationState(
        { verifiedAt: null, verifiedGameVersion: { name: "0.8.14" } },
        "0.8.14"
      )
    ).toBe("unverified");
    expect(
      resolvePublicVerificationState(
        { verifiedAt, verifiedGameVersion: null },
        "0.8.14"
      )
    ).toBe("unverified");
    expect(
      resolvePublicVerificationState(
        { verifiedAt: "not-a-date", verifiedGameVersion: { name: "0.8.14" } },
        "0.8.14"
      )
    ).toBe("unverified");
  });

  it("never claims a record matches a current build it cannot identify", () => {
    // With no current version configured, a stamped record is outdated, not
    // verified: the site does not know what the current build is.
    expect(
      resolvePublicVerificationState(
        { verifiedAt, verifiedGameVersion: { name: "0.8.14" } },
        null
      )
    ).toBe("outdated");
  });

  it("keeps every label and note free of database vocabulary", () => {
    const technical =
      /verifiedGameVersion|GameVersion|isCurrent|enum|foreign key|revision|null/i;
    for (const state of ["verified", "outdated", "unverified"] as const) {
      expect(PUBLIC_VERIFICATION_STATE_LABELS[state]).not.toMatch(technical);
      expect(PUBLIC_VERIFICATION_STATE_NOTES[state]).not.toMatch(technical);
      expect(PUBLIC_VERIFICATION_STATE_LABELS[state]).toMatch(/^[A-Z][a-z]+$/);
    }
  });
});
