// Pure display-precedence logic for ImagePanel (Admin UI Corrections
// pass), extracted so the decision of "which image shows, and is it
// muted for pending removal" can be fully unit-tested without a DOM —
// ImagePanel itself only needs a real browser to prove the INTERACTIVE
// parts (the file input's onChange, the removeImage checkbox's onChange),
// not this precedence/muting decision, which is plain data in, plain data
// out.
//
// Precedence: a freshly chosen local file (previewUrl) always wins —
// otherwise the record's own persisted image (imageUrl), REGARDLESS of
// whether its removal is pending (removal only mutes the display, see
// isPendingRemoval, it never swaps the image out before save) — otherwise
// the optional inherited fallback (Recipe Image Inheritance follow-up;
// `inheritedImageUrl` is `undefined` for every non-Recipe caller, which
// collapses every inheritance-related field below to its inert default).

export type ImagePanelDisplayInput = {
  /** A freshly chosen local file's object URL, or null when none is
      selected. */
  previewUrl: string | null;
  /** The record's own persisted image, or null when it has none. */
  imageUrl: string | null;
  /** Optional read-only display fallback (e.g. a Recipe's resulting Item
      image). Omit entirely (leave undefined) to disable inheritance —
      every non-Recipe caller today. */
  inheritedImageUrl?: string | null;
  /** Whether the removeImage checkbox is currently checked. */
  removed: boolean;
};

export type ImagePanelDisplayResult = {
  /** The URL to actually render in the `<img>`, or null for the empty
      fallback state. */
  displayImageUrl: string | null;
  /** True only while the PERSISTED image is what's on screen and its
      removal is pending — never while previewing a local file, which
      always takes precedence and must never look muted. */
  isPendingRemoval: boolean;
  /** True only when there is no persisted image at all (never merely
      because removal is pending) and an inherited fallback is being shown
      instead. */
  isShowingInherited: boolean;
  /** True only when the persisted image is on screen, an inherited
      fallback is also available, and removal is NOT pending — while
      pending, the plain "will be removed" warning takes precedence over
      this note instead. */
  isShowingOverride: boolean;
};

export function resolveImagePanelDisplay({
  previewUrl,
  imageUrl,
  inheritedImageUrl,
  removed,
}: ImagePanelDisplayInput): ImagePanelDisplayResult {
  const hasInheritance = inheritedImageUrl !== undefined;
  const inheritedFallback = inheritedImageUrl ?? null;
  const displayImageUrl = previewUrl ?? imageUrl ?? inheritedFallback;

  const isPendingRemoval = removed && !previewUrl && Boolean(imageUrl);
  const isShowingPersisted = !previewUrl && Boolean(imageUrl);
  const isShowingInherited =
    hasInheritance && !previewUrl && !imageUrl && inheritedFallback !== null;
  const isShowingOverride =
    hasInheritance && isShowingPersisted && !isPendingRemoval;

  return { displayImageUrl, isPendingRemoval, isShowingInherited, isShowingOverride };
}
