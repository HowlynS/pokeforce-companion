import { describe, expect, it } from "vitest";
import { requestsVerification } from "./content-authorization";

describe("verification mutation detection", () => {
  it("ignores ordinary edits and unchecked verification controls", () => {
    const data = new FormData();
    data.set("name", "Iron Ore");
    data.set("markVerified", "");
    expect(requestsVerification(data)).toBe(false);
  });

  it("detects root and nested forged verification requests", () => {
    const root = new FormData();
    root.set("markVerified", "on");
    expect(requestsVerification(root)).toBe(true);

    const nested = new FormData();
    nested.set("listing.0.markVerified", "on");
    expect(requestsVerification(nested)).toBe(true);
  });
});
