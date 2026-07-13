import Image from "next/image";
import { designTokens } from "@/lib/design-tokens";
import { getImagePublicUrl } from "@/lib/storage/images";

type ContentImageProps = {
  /** Storage object path from a trusted database record (never a URL). */
  imagePath: string | null;
  alt: string;
  size?: "card" | "detail";
};

const CANVAS_SIZES = {
  card: 96,
  detail: 160,
} as const;

/**
 * Fixed square display canvas (96×96 for cards, 160×160 for detail pages)
 * with a same-sized no-image fallback, so records with and without images
 * occupy identical space. The image is display-resized only — the stored
 * object is untouched — scaled up or down to fit the square via
 * object-fit: contain, so a non-square source is centered without cropping
 * or distortion, using the browser's normal image rendering.
 */
export async function ContentImage({
  imagePath,
  alt,
  size = "card",
}: ContentImageProps) {
  const imageUrl = await getImagePublicUrl(imagePath);
  const canvasSize = CANVAS_SIZES[size];

  return (
    <div
      style={{
        width: `${canvasSize}px`,
        height: `${canvasSize}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${designTokens.colors.border}`,
        borderRadius: designTokens.radius.sm,
        background: designTokens.colors.surfaceSoft,
        padding: "4px",
        overflow: "hidden",
      }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          width={canvasSize}
          height={canvasSize}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <span
          style={{
            color: designTokens.colors.textMuted,
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          No image available
        </span>
      )}
    </div>
  );
}
