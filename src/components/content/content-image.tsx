import Image from "next/image";
import { getImagePublicUrl } from "@/lib/storage/images";

type ContentImageProps = {
  /** Storage object path from a trusted database record (never a URL). */
  imagePath: string | null;
  alt: string;
  size?: "card" | "detail" | "hero" | "row";
};

const DISPLAY_SIZES = {
  card: 96,
  detail: 160,
  hero: 192,
  row: 48,
} as const;

/**
 * Shared public sprite stage. Stored objects and URL resolution remain
 * untouched; the browser scales transparent sprites with nearest-neighbor
 * rendering inside controlled, integer-friendly display bounds.
 */
export async function ContentImage({
  imagePath,
  alt,
  size = "card",
}: ContentImageProps) {
  const imageUrl = await getImagePublicUrl(imagePath);
  const displaySize = DISPLAY_SIZES[size];

  return (
    <span
      className={`public-sprite-stage public-sprite-stage--${size}${
        imageUrl ? "" : " public-sprite-stage--empty"
      }`}
    >
      {imageUrl ? (
        <Image
          className="public-sprite-image"
          src={imageUrl}
          alt={alt}
          width={displaySize}
          height={displaySize}
        />
      ) : (
        <span
          className="public-sprite-fallback"
          aria-label="No image available"
        >
          {size === "row" ? "No image" : "No image available"}
        </span>
      )}
    </span>
  );
}
