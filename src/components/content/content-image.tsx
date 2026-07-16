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
 * Fixed square display canvas (96×96 for cards, 160×160 for detail pages).
 * The image is display-resized only — the stored object is untouched —
 * scaled up or down to fit the square via object-fit: contain, so a
 * non-square source is centered without cropping or distortion, using the
 * browser's normal image rendering.
 *
 * Records without an image render a compact muted pill instead of a
 * full-size empty canvas, so the missing-image state stays quiet inside
 * cards and detail pages.
 */
export async function ContentImage({
  imagePath,
  alt,
  size = "card",
}: ContentImageProps) {
  const imageUrl = await getImagePublicUrl(imagePath);
  const canvasSize = CANVAS_SIZES[size];

  if (!imageUrl) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          border: `1px solid ${designTokens.colors.border}`,
          borderRadius: designTokens.radius.sm,
          background: designTokens.colors.surfaceSoft,
          color: designTokens.colors.textMuted,
          padding: "4px 10px",
          fontSize: "13px",
          lineHeight: 1.4,
        }}
      >
        No image available
      </span>
    );
  }

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
    </div>
  );
}
