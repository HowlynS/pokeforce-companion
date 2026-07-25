import { describe, expect, it } from "vitest";
import { formatPublicVerification } from "@/lib/public-verification";

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
