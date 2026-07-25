import { describe, expect, it } from "vitest";
import { formatInventoryListingCount } from "@/lib/shops/public-shop";

describe("formatInventoryListingCount", () => {
  it.each([
    [0, "0 inventory listings"],
    [1, "1 inventory listing"],
    [2, "2 inventory listings"],
  ])("formats %i deterministically", (count, expected) => {
    expect(formatInventoryListingCount(count)).toBe(expected);
  });
});
