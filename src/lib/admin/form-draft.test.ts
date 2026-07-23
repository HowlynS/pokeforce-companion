import { describe, expect, it } from "vitest";
import {
  ADMIN_DRAFT_SCHEMA_VERSION,
  createDraft,
  parseDraft,
  serializeDraft,
} from "@/lib/admin/form-draft";

const KEY = "item:edit:item-1:item-edit-form";

describe("createDraft / serializeDraft round-trip", () => {
  it("round-trips a draft through JSON with its values and metadata intact", () => {
    const draft = createDraft(
      { key: KEY, serverUpdatedAt: "2026-07-23T00:00:00.000Z" },
      { name: ["Iron Sword"], baseValue: ["10"] }
    );
    const parsed = parseDraft(serializeDraft(draft), KEY);
    expect(parsed).not.toBeNull();
    expect(parsed!.schema).toBe(ADMIN_DRAFT_SCHEMA_VERSION);
    expect(parsed!.key).toBe(KEY);
    expect(parsed!.serverUpdatedAt).toBe("2026-07-23T00:00:00.000Z");
    expect(parsed!.values).toEqual({ name: ["Iron Sword"], baseValue: ["10"] });
  });

  it("records submittedAt only when supplied", () => {
    const plain = createDraft({ key: KEY }, { name: ["x"] });
    expect(plain.submittedAt).toBeUndefined();
    const submitted = createDraft({ key: KEY }, { name: ["x"] }, { submittedAt: 123 });
    expect(submitted.submittedAt).toBe(123);
    expect(parseDraft(serializeDraft(submitted), KEY)!.submittedAt).toBe(123);
  });
});

describe("parseDraft: defensive validation", () => {
  it("returns null for null/empty input", () => {
    expect(parseDraft(null, KEY)).toBeNull();
    expect(parseDraft("", KEY)).toBeNull();
    expect(parseDraft(undefined, KEY)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseDraft("{not json", KEY)).toBeNull();
  });

  it("returns null for a mismatched schema version (draft schema drift)", () => {
    const stale = JSON.stringify({
      schema: ADMIN_DRAFT_SCHEMA_VERSION + 1,
      key: KEY,
      savedAt: Date.now(),
      values: { name: ["x"] },
    });
    expect(parseDraft(stale, KEY)).toBeNull();
  });

  it("returns null when the stored key does not match the expected key (isolation)", () => {
    const other = serializeDraft(createDraft({ key: "item:edit:OTHER" }, { name: ["x"] }));
    expect(parseDraft(other, KEY)).toBeNull();
  });

  it("returns null when values are structurally invalid", () => {
    const bad = JSON.stringify({
      schema: ADMIN_DRAFT_SCHEMA_VERSION,
      key: KEY,
      savedAt: Date.now(),
      values: { name: "not-an-array" },
    });
    expect(parseDraft(bad, KEY)).toBeNull();
  });

  it("returns null when savedAt is missing", () => {
    const bad = JSON.stringify({
      schema: ADMIN_DRAFT_SCHEMA_VERSION,
      key: KEY,
      values: { name: ["x"] },
    });
    expect(parseDraft(bad, KEY)).toBeNull();
  });
});

describe("draft isolation across record keys", () => {
  it("a draft serialized for one record never parses for another", () => {
    const itemA = serializeDraft(
      createDraft({ key: "item:edit:A:f" }, { name: ["A"] })
    );
    expect(parseDraft(itemA, "item:edit:B:f")).toBeNull();
    // create vs edit isolation
    expect(parseDraft(itemA, "item:new:f")).toBeNull();
  });
});
