import { createClient } from "@/lib/supabase/server";

export const APPEARANCE_ASSET_BUCKET = "game-images";

export type AppearanceAssetKind =
  | "header-logo"
  | "favicon"
  | "home-background"
  | "catalogue-background"
  | "item-detail-background";

export type AppearanceAssetDimensions = {
  width: number;
  height: number;
};

type AppearanceAssetValidation =
  | {
      ok: true;
      mimeType: string;
      extension: "png" | "jpg" | "webp" | "ico";
      dimensions: AppearanceAssetDimensions;
    }
  | {
      ok: false;
      error:
        | "missing_asset"
        | "asset_too_large"
        | "invalid_asset_type"
        | "invalid_asset_file"
        | "invalid_asset_dimensions";
      message: string;
    };

export class AppearanceAssetStorageError extends Error {
  constructor(
    public readonly kind: "validation" | "upload" | "delete" | "unsafe_path",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "AppearanceAssetStorageError";
  }
}

const APPEARANCE_PATH_PATTERN =
  /^appearance\/(header-logo|favicon|home-background|catalogue-background|item-detail-background)\/[0-9a-f-]+\.(png|jpg|webp|ico)$/;

const WALLPAPER_KINDS = new Set<AppearanceAssetKind>([
  "home-background",
  "catalogue-background",
  "item-detail-background",
]);

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function pngDimensions(bytes: Uint8Array): AppearanceAssetDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < 24 ||
    !signature.every((value, index) => bytes[index] === value)
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array): AppearanceAssetDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }
    if (offset + 2 > bytes.length) {
      return null;
    }
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) {
      return null;
    }
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker
      )
    ) {
      if (length < 7) {
        return null;
      }
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): AppearanceAssetDimensions | null {
  const ascii = (offset: number, text: string) =>
    [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
  if (bytes.length < 30 || !ascii(0, "RIFF") || !ascii(8, "WEBP")) {
    return null;
  }

  if (ascii(12, "VP8X") && bytes.length >= 30) {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }
  if (ascii(12, "VP8L") && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits =
      bytes[21] |
      (bytes[22] << 8) |
      (bytes[23] << 16) |
      (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (
    ascii(12, "VP8 ") &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

function icoDimensions(bytes: Uint8Array): AppearanceAssetDimensions | null {
  if (
    bytes.length < 22 ||
    bytes[0] !== 0 ||
    bytes[1] !== 0 ||
    bytes[2] !== 1 ||
    bytes[3] !== 0 ||
    bytes[4] === 0
  ) {
    return null;
  }
  return {
    width: bytes[6] === 0 ? 256 : bytes[6],
    height: bytes[7] === 0 ? 256 : bytes[7],
  };
}

function dimensionsFor(
  mimeType: string,
  bytes: Uint8Array
): AppearanceAssetDimensions | null {
  switch (mimeType) {
    case "image/png":
      return pngDimensions(bytes);
    case "image/jpeg":
      return jpegDimensions(bytes);
    case "image/webp":
      return webpDimensions(bytes);
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return icoDimensions(bytes);
    default:
      return null;
  }
}

export async function validateAppearanceAsset(
  file: File | null | undefined,
  kind: AppearanceAssetKind
): Promise<AppearanceAssetValidation> {
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: "missing_asset",
      message: "Choose a file to upload.",
    };
  }

  const isFavicon = kind === "favicon";
  const allowedTypes = isFavicon
    ? ["image/png", "image/x-icon", "image/vnd.microsoft.icon"]
    : ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return {
      ok: false,
      error: "invalid_asset_type",
      message: isFavicon
        ? "Favicons must be PNG or ICO files."
        : "Use a PNG, JPEG, or WebP image.",
    };
  }

  const maxBytes = isFavicon
    ? 1024 * 1024
    : WALLPAPER_KINDS.has(kind)
      ? 10 * 1024 * 1024
      : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: "asset_too_large",
      message: isFavicon
        ? "The favicon must be 1 MB or smaller."
        : WALLPAPER_KINDS.has(kind)
          ? "Wallpaper images must be 10 MB or smaller."
          : "The logo must be 5 MB or smaller.",
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return {
      ok: false,
      error: "invalid_asset_file",
      message: "The selected file could not be read.",
    };
  }

  const dimensions = dimensionsFor(file.type, bytes);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return {
      ok: false,
      error: "invalid_asset_file",
      message: "The selected file is malformed or does not match its file type.",
    };
  }

  const [minimum, maximum] = isFavicon
    ? [16, 512]
    : WALLPAPER_KINDS.has(kind)
      ? [640, 8192]
      : [32, 4096];
  if (
    dimensions.width < minimum ||
    dimensions.height < minimum ||
    dimensions.width > maximum ||
    dimensions.height > maximum
  ) {
    return {
      ok: false,
      error: "invalid_asset_dimensions",
      message: isFavicon
        ? "Favicons must be between 16×16 and 512×512 pixels."
        : WALLPAPER_KINDS.has(kind)
          ? "Wallpapers must be between 640×640 and 8192×8192 pixels."
          : "Logo dimensions must be between 32×32 and 4096×4096 pixels.",
    };
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/webp"
          ? "webp"
          : "ico";
  return { ok: true, mimeType: file.type, extension, dimensions };
}

export function generateAppearanceAssetPath(
  kind: AppearanceAssetKind,
  extension: "png" | "jpg" | "webp" | "ico"
): string {
  return `appearance/${kind}/${crypto.randomUUID()}.${extension}`;
}

export function isSafeAppearanceAssetPath(path: string): boolean {
  return APPEARANCE_PATH_PATTERN.test(path);
}

export async function uploadAppearanceAsset(
  kind: AppearanceAssetKind,
  file: File
): Promise<{ path: string; width: number; height: number }> {
  const validation = await validateAppearanceAsset(file, kind);
  if (!validation.ok) {
    throw new AppearanceAssetStorageError("validation", validation.message);
  }

  const path = generateAppearanceAssetPath(kind, validation.extension);
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(APPEARANCE_ASSET_BUCKET)
    .upload(path, file, {
      contentType: validation.mimeType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) {
    throw new AppearanceAssetStorageError(
      "upload",
      "The asset could not be uploaded. Please try again.",
      { cause: error }
    );
  }
  return { path, ...validation.dimensions };
}

export async function deleteAppearanceAsset(path: string | null | undefined) {
  if (!path) {
    return;
  }
  if (!isSafeAppearanceAssetPath(path)) {
    throw new AppearanceAssetStorageError(
      "unsafe_path",
      "The stored appearance asset path is invalid."
    );
  }
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(APPEARANCE_ASSET_BUCKET)
    .remove([path]);
  if (error) {
    throw new AppearanceAssetStorageError(
      "delete",
      "The old appearance asset could not be removed.",
      { cause: error }
    );
  }
}
