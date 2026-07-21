import { describe, expect, it, vi } from "vitest";

// images.ts imports the Supabase server client at module scope (whose own
// next/headers import cannot load outside a Next.js request). The pure
// functions under test never touch it, so the module is stubbed out before
// the import below — no Supabase client is ever created in these tests.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => {
    throw new Error("createClient must not be called by these unit tests");
  }),
}));

import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_BUCKET,
  MAX_IMAGE_SIZE_BYTES,
  generateImageObjectPath,
  isSafeImageObjectPath,
  validateImageFile,
} from "@/lib/storage/images";

function makeFile(sizeInBytes: number, mimeType: string): File {
  return new File([new Uint8Array(sizeInBytes)], "player-upload.png", {
    type: mimeType,
  });
}

describe("storage constants", () => {
  it("match the documented bucket, size limit, and MIME allowlist", () => {
    expect(IMAGE_BUCKET).toBe("game-images");
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);
  });
});

describe("validateImageFile", () => {
  it("treats a non-File value as a missing image", () => {
    const result = validateImageFile(undefined as unknown as File);

    expect(result).toEqual({
      ok: false,
      error: "missing_image",
      message: "Please choose an image file.",
    });
  });

  it("treats a zero-byte file (an untouched file input) as a missing image", () => {
    const result = validateImageFile(makeFile(0, "image/png"));

    expect(result).toEqual({
      ok: false,
      error: "missing_image",
      message: "Please choose an image file.",
    });
  });

  it.each(["image/png", "image/jpeg", "image/webp"])(
    "accepts a small %s file and reports its MIME type",
    (mimeType) => {
      const result = validateImageFile(makeFile(16, mimeType));

      expect(result).toEqual({ ok: true, mimeType });
    }
  );

  it("rejects SVG", () => {
    const result = validateImageFile(makeFile(16, "image/svg+xml"));

    expect(result).toEqual({
      ok: false,
      error: "invalid_image_type",
      message: "Only PNG, JPEG, and WebP images are allowed.",
    });
  });

  it("rejects other unsupported MIME types", () => {
    const result = validateImageFile(makeFile(16, "application/pdf"));

    expect(result).toEqual({
      ok: false,
      error: "invalid_image_type",
      message: "Only PNG, JPEG, and WebP images are allowed.",
    });
  });

  it("accepts a file exactly at the 5 MB limit and rejects one byte more", () => {
    // One shared buffer at the limit; the oversized file reuses it plus one
    // extra byte instead of allocating a second 5 MB block.
    const maxSizedBytes = new Uint8Array(MAX_IMAGE_SIZE_BYTES);
    const atLimit = new File([maxSizedBytes], "at-limit.png", {
      type: "image/png",
    });
    const overLimit = new File([maxSizedBytes, new Uint8Array(1)], "over.png", {
      type: "image/png",
    });

    expect(validateImageFile(atLimit)).toEqual({
      ok: true,
      mimeType: "image/png",
    });
    expect(validateImageFile(overLimit)).toEqual({
      ok: false,
      error: "image_too_large",
      message: "The image must be 5 MB or smaller.",
    });
  });
});

describe("generateImageObjectPath", () => {
  it.each([
    ["items", "image/png", /^items\/[0-9a-f-]+\.png$/],
    ["professions", "image/jpeg", /^professions\/[0-9a-f-]+\.jpg$/],
    ["recipes", "image/webp", /^recipes\/[0-9a-f-]+\.webp$/],
    ["categories", "image/png", /^categories\/[0-9a-f-]+\.png$/],
  ] as const)(
    "builds a %s path with the controlled extension for %s",
    (resourceType, mimeType, expectedPattern) => {
      const path = generateImageObjectPath(resourceType, mimeType);

      expect(path).toMatch(expectedPattern);
    }
  );

  it("never reuses a client filename — the name is fully server-generated", () => {
    // The generator does not even accept a filename, so any client-supplied
    // name is structurally impossible to leak into the path.
    const path = generateImageObjectPath("items", "image/png");

    expect(path).not.toContain("player-upload");
    expect(path).toMatch(/^items\/[0-9a-f-]+\.png$/);
  });

  it("produces distinct paths on every call", () => {
    const paths = new Set(
      Array.from({ length: 20 }, () =>
        generateImageObjectPath("items", "image/png")
      )
    );

    expect(paths.size).toBe(20);
  });

  it("always produces paths that pass the module's own safety guard", () => {
    for (const [resourceType, mimeType] of [
      ["items", "image/png"],
      ["professions", "image/jpeg"],
      ["recipes", "image/webp"],
      ["categories", "image/png"],
    ] as const) {
      const path = generateImageObjectPath(resourceType, mimeType);

      expect(isSafeImageObjectPath(path)).toBe(true);
    }
  });
});

describe("isSafeImageObjectPath", () => {
  it.each([
    "items/550e8400-e29b-41d4-a716-446655440000.png",
    "professions/abc-123.jpg",
    "recipes/xyz-789.webp",
    "categories/def-456.png",
  ])("accepts the generated-shape path %j", (path) => {
    expect(isSafeImageObjectPath(path)).toBe(true);
  });

  it.each([
    ["a wrong top-level folder", "users/file.png"],
    ["a missing filename", "items/"],
    ["a nested extra directory", "items/nested/file.png"],
    ["a path traversal attempt", "../items/file.png"],
    ["a traversal inside the folder", "items/../items/file.png"],
    ["a leading slash", "/items/file.png"],
    ["a full public URL", "https://example.com/items/file.png"],
    ["a bucket-qualified path", "game-images/items/file.png"],
    ["an unsupported extension", "items/file.gif"],
    ["a name with no extension", "items/file"],
    ["uppercase characters outside the generated shape", "items/FILE.PNG"],
    ["an empty string", ""],
  ])("rejects %s: %j", (_label, path) => {
    expect(isSafeImageObjectPath(path)).toBe(false);
  });
});
