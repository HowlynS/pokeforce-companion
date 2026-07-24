// Shared compact resource icon (Admin Polish Pass 1) — one presentation for
// every image-enabled entity shown inline in an AdminSelect option/trigger
// or a relationship table/list, rather than duplicating thumbnail+fallback
// markup per call site. Deliberately smaller and more restrained than the
// existing .admin-record-thumb-wrap (the 64x64 record-list row thumbnail)
// and .admin-image-preview-lg (the large editor preview) — this is an
// inline glyph beside text, never the visual focus of its row.
//
// Uses existing image URLs only (server-resolved public URLs already
// loaded by the calling page's own query) — never base64, never a new
// fetch, never next/image (matching every other admin thumbnail's plain
// <img> convention, which intentionally skips the optimization pipeline
// for admin-only chrome).

type ResourceIconSize = "sm" | "md";

export type ResourceIconProps = {
  /** The resource's resolved public image URL, or null/undefined when it
      has none — the fixed slot and fallback render either way. */
  imageUrl?: string | null;
  /** Empty (the default) for a decorative icon beside an already-visible
      name/link; set a real description only when the image is the sole
      representation of the resource in that context. */
  alt?: string;
  /** "sm" (~22px) for AdminSelect triggers/options; "md" (~28px) for
      relationship tables/lists where a little more room exists. */
  size?: ResourceIconSize;
  className?: string;
};

export function ResourceIcon({
  imageUrl,
  alt = "",
  size = "sm",
  className,
}: ResourceIconProps) {
  const hasImage = Boolean(imageUrl);
  const classes = [
    "resource-icon",
    size === "md" ? "resource-icon-md" : "resource-icon-sm",
    hasImage ? undefined : "resource-icon-empty",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-hidden={hasImage ? undefined : true}>
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-only inline icon; matches the existing thumbnail/preview convention (plain <img>, no next/image optimization pipeline)
        <img src={imageUrl!} alt={alt} className="resource-icon-img" />
      ) : null}
    </span>
  );
}
