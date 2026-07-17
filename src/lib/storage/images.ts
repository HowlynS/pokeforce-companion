// Server-only image storage utilities for the game-images Supabase bucket.
// This module is server-only by construction: it imports the Supabase server
// client, whose next/headers dependency makes any Client Component import
// fail at build time (the same boundary src/lib/supabase/server.ts relies on).
//
// Authorization is deliberately NOT handled here. Every mutating server
// action must call requireAdminUser() itself at the top, per the established
// admin mutation pattern — these helpers only perform the storage work.

import { createClient } from "@/lib/supabase/server";

export const IMAGE_BUCKET = "game-images";

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * The only resource folders an object path may start with. Callers pick one
 * of these; arbitrary folder names are never accepted.
 */
export type ImageResourceType = "items" | "recipes" | "professions" | "locations";

// Controlled extensions derived from the validated MIME type. The client
// filename (and its extension) is never used for anything.
const MIME_EXTENSIONS: Record<AllowedImageMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Matches exactly one supported folder, then one generated file name
// (lowercase UUID) with one controlled extension. Anything else — traversal
// segments, absolute URLs, bucket-qualified strings, unrelated folders,
// empty strings — fails to match. No normalization is applied before the
// check, so an unsafe path can never be rewritten into an allowed one.
const SAFE_OBJECT_PATH_PATTERN =
  /^(items|recipes|professions|locations)\/[a-z0-9-]+\.(png|jpg|webp)$/;

export type ImageStorageErrorKind =
  | "validation"
  | "upload"
  | "delete"
  | "unsafe_path";

/**
 * Internal error for storage failures. `message` is always safe to convert
 * into a readable admin-facing message; the raw Supabase error (when there
 * is one) is preserved on `cause` for development, never shown to users.
 */
export class ImageStorageError extends Error {
  readonly kind: ImageStorageErrorKind;

  constructor(
    kind: ImageStorageErrorKind,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "ImageStorageError";
    this.kind = kind;
  }
}

export type ImageFileValidationError =
  | "missing_image"
  | "image_too_large"
  | "invalid_image_type";

export type ImageFileValidationResult =
  | { ok: true; mimeType: AllowedImageMimeType }
  | { ok: false; error: ImageFileValidationError; message: string };

/**
 * First-stage validation of an uploaded image file. Size is checked against
 * the real byte length; type is checked against the browser-supplied MIME
 * type (this does not inspect the file's binary signature — the bucket's own
 * MIME/size restrictions are the second line of defense). The filename and
 * its extension are never consulted.
 */
export function validateImageFile(file: File): ImageFileValidationResult {
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: "missing_image",
      message: "Please choose an image file.",
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      ok: false,
      error: "image_too_large",
      message: "The image must be 5 MB or smaller.",
    };
  }

  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: "invalid_image_type",
      message: "Only PNG, JPEG, and WebP images are allowed.",
    };
  }

  return { ok: true, mimeType: file.type as AllowedImageMimeType };
}

/**
 * Generates a new unique object path: `<resource-type>/<uuid>.<ext>`. The
 * name is entirely server-generated — no client filename, slug, or other
 * user-controlled value is ever part of the path — and every upload gets a
 * fresh path, so existing objects are never overwritten in place.
 */
export function generateImageObjectPath(
  resourceType: ImageResourceType,
  mimeType: AllowedImageMimeType
): string {
  return `${resourceType}/${crypto.randomUUID()}.${MIME_EXTENSIONS[mimeType]}`;
}

/**
 * True only for paths shaped exactly like our generated ones, inside one of
 * the three supported resource folders. Use this before any destructive
 * storage operation.
 */
export function isSafeImageObjectPath(path: string): boolean {
  return SAFE_OBJECT_PATH_PATTERN.test(path);
}

/**
 * Validates the file, uploads it to a new unique path in game-images, and
 * returns the stored object path (never a full URL — the database stores
 * paths only). Runs as the current authenticated cookie session, so the
 * bucket's admin-only write policies apply. Throws ImageStorageError with
 * kind "validation" or "upload"; the message is safe to show an admin.
 */
export async function uploadImage(
  resourceType: ImageResourceType,
  file: File
): Promise<string> {
  const validation = validateImageFile(file);

  if (!validation.ok) {
    throw new ImageStorageError("validation", validation.message);
  }

  const objectPath = generateImageObjectPath(resourceType, validation.mimeType);
  const supabase = await createClient();

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(objectPath, file, {
      contentType: validation.mimeType,
      upsert: false,
      // Paths are unique and never reused, so the object is immutable and
      // can be cached aggressively (one year).
      cacheControl: "31536000",
    });

  if (error) {
    throw new ImageStorageError(
      "upload",
      "The image could not be uploaded. Please try again.",
      { cause: error }
    );
  }

  return objectPath;
}

/**
 * Derives the public URL for a stored object path, or null when no image is
 * stored. This is pure URL construction via the Supabase storage API — it
 * does not verify that the object actually exists, and the result is never
 * written to the database (paths only).
 */
export async function getImagePublicUrl(
  objectPath: string | null | undefined
): Promise<string | null> {
  if (!objectPath || objectPath.trim() === "") {
    return null;
  }

  const supabase = await createClient();
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath);

  return data.publicUrl;
}

/**
 * Removes one object from game-images. A missing/blank path is a harmless
 * no-op (the record simply had no image). Callers must pass a path read
 * from a trusted database record — never a client-submitted value — and the
 * path guard rejects anything outside items/, recipes/, or professions/.
 * Throws ImageStorageError with kind "unsafe_path" or "delete".
 */
export async function deleteImage(
  objectPath: string | null | undefined
): Promise<void> {
  if (!objectPath || objectPath.trim() === "") {
    return;
  }

  if (!isSafeImageObjectPath(objectPath)) {
    throw new ImageStorageError(
      "unsafe_path",
      "The stored image path is not valid."
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .remove([objectPath]);

  if (error) {
    throw new ImageStorageError(
      "delete",
      "The image could not be removed. Please try again.",
      { cause: error }
    );
  }
}
