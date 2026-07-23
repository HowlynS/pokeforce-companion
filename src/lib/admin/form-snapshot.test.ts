import { describe, expect, it } from "vitest";
import {
  canonicalizeSnapshot,
  draftableValues,
  isFileMarker,
  normalizeSnapshotValue,
  snapshotFormData,
  snapshotsEqual,
} from "@/lib/admin/form-snapshot";

// snapshotFormData accepts any iterable of [name, value] pairs, so the
// tests drive it with plain arrays (and file-like objects) — no DOM form
// needed, matching the module's DOM-free design.
type Pair = [string, string | { name: string; size: number; lastModified?: number }];

function snap(pairs: Pair[], exclude?: string[]) {
  return snapshotFormData(pairs, exclude ? { exclude } : undefined);
}

describe("snapshotFormData: baseline and meaningful change", () => {
  it("treats an unchanged set of entries as equal (clean)", () => {
    const a = snap([
      ["name", "Iron Sword"],
      ["baseValue", "10"],
    ]);
    const b = snap([
      ["name", "Iron Sword"],
      ["baseValue", "10"],
    ]);
    expect(snapshotsEqual(a, b)).toBe(true);
  });

  it("detects a text change as different (dirty)", () => {
    const base = snap([["name", "Iron Sword"]]);
    const changed = snap([["name", "Iron Shield"]]);
    expect(snapshotsEqual(base, changed)).toBe(false);
  });

  it("returns equal again after a revert to the original value (clean)", () => {
    const base = snap([["name", "Iron Sword"]]);
    const reverted = snap([["name", "Iron Sword"]]);
    expect(snapshotsEqual(base, reverted)).toBe(true);
  });
});

describe("snapshotFormData: checkboxes", () => {
  it("represents an unchecked checkbox as absent, so check-then-uncheck returns to baseline", () => {
    const base = snap([["name", "x"]]); // heldItem unchecked -> absent
    const checked = snap([
      ["name", "x"],
      ["heldItem", "on"],
    ]);
    const unchecked = snap([["name", "x"]]);
    expect(snapshotsEqual(base, checked)).toBe(false);
    expect(snapshotsEqual(base, unchecked)).toBe(true);
  });
});

describe("snapshotFormData: numbers and selects", () => {
  it("compares numeric strings by value representation", () => {
    const a = snap([["baseValue", "1"]]);
    const b = snap([["baseValue", "1"]]);
    expect(snapshotsEqual(a, b)).toBe(true);
    expect(snapshotsEqual(a, snap([["baseValue", "2"]]))).toBe(false);
  });

  it("detects a select change and a revert", () => {
    const base = snap([["categoryId", "cat-1"]]);
    expect(snapshotsEqual(base, snap([["categoryId", "cat-2"]]))).toBe(false);
    expect(snapshotsEqual(base, snap([["categoryId", "cat-1"]]))).toBe(true);
  });
});

describe("snapshotFormData: normalization", () => {
  it("normalizes CRLF and CR line endings so they never create false dirtiness", () => {
    expect(normalizeSnapshotValue("a\r\nb\rc")).toBe("a\nb\nc");
    const crlf = snap([["description", "line1\r\nline2"]]);
    const lf = snap([["description", "line1\nline2"]]);
    expect(snapshotsEqual(crlf, lf)).toBe(true);
  });

  it("does NOT trim, so a trailing space is a (safe) difference", () => {
    const base = snap([["name", "Sword"]]);
    const trailing = snap([["name", "Sword "]]);
    expect(snapshotsEqual(base, trailing)).toBe(false);
  });
});

describe("snapshotFormData: excluded fields", () => {
  it("always excludes $-prefixed framework fields", () => {
    const withAction = snap([
      ["name", "x"],
      ["$ACTION_ID_abc", "1"],
    ]);
    const without = snap([["name", "x"]]);
    expect(snapshotsEqual(withAction, without)).toBe(true);
  });

  it("excludes caller-listed immutable fields (id, originalSlug, verifiedGameVersionId)", () => {
    const a = snap(
      [
        ["name", "x"],
        ["id", "item-1"],
        ["originalSlug", "x"],
        ["verifiedGameVersionId", "gv-1"],
      ],
      ["id", "originalSlug", "verifiedGameVersionId"]
    );
    const b = snap(
      [
        ["name", "x"],
        ["id", "item-1"],
        ["originalSlug", "x"],
        ["verifiedGameVersionId", "gv-2"], // different, but excluded
      ],
      ["id", "originalSlug", "verifiedGameVersionId"]
    );
    expect(snapshotsEqual(a, b)).toBe(true);
  });

  it("still detects a change in an INCLUDED semantic checkbox (markVerified)", () => {
    const base = snap([["name", "x"]], ["id"]);
    const verified = snap(
      [
        ["name", "x"],
        ["markVerified", "on"],
      ],
      ["id"]
    );
    expect(snapshotsEqual(base, verified)).toBe(false);
  });
});

describe("snapshotFormData: field order independence and repeated names", () => {
  it("is independent of the order different field names appear in", () => {
    const a = snap([
      ["name", "x"],
      ["categoryId", "c1"],
    ]);
    const b = snap([
      ["categoryId", "c1"],
      ["name", "x"],
    ]);
    expect(snapshotsEqual(a, b)).toBe(true);
    expect(canonicalizeSnapshot(a)).toBe(canonicalizeSnapshot(b));
  });

  it("preserves the order of repeated values under a single name", () => {
    const a = snap([
      ["ingredient", "iron"],
      ["ingredient", "wood"],
    ]);
    const b = snap([
      ["ingredient", "wood"],
      ["ingredient", "iron"],
    ]);
    expect(snapshotsEqual(a, b)).toBe(false);
  });
});

describe("snapshotFormData: files", () => {
  it("treats an untouched (empty, zero-byte) file input as absent", () => {
    const base = snap([["name", "x"]]);
    const withEmptyFile = snap([
      ["name", "x"],
      ["image", { name: "", size: 0 }],
    ]);
    expect(snapshotsEqual(base, withEmptyFile)).toBe(true);
  });

  it("marks a selected file as different from no file, without storing bytes", () => {
    const base = snap([["name", "x"]]);
    const withFile = snap([
      ["name", "x"],
      ["image", { name: "sword.png", size: 1234, lastModified: 42 }],
    ]);
    expect(snapshotsEqual(base, withFile)).toBe(false);
    const marker = withFile.image[0];
    expect(isFileMarker(marker)).toBe(true);
    // Only metadata, never content.
    expect(marker).toContain("sword.png");
    expect(marker).toContain("1234");
  });
});

describe("draftableValues", () => {
  it("keeps string fields but drops non-restorable file markers", () => {
    const snapshot = snap([
      ["name", "x"],
      ["image", { name: "a.png", size: 10 }],
    ]);
    const draftable = draftableValues(snapshot);
    expect(draftable.name).toEqual(["x"]);
    expect(draftable.image).toBeUndefined();
  });
});
