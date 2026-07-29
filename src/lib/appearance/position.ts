import { clampAppearancePercentage, type ScenicPosition } from "./defaults";

export function positionFromPointerDrag({
  start,
  deltaX,
  deltaY,
  width,
  height,
}: {
  start: ScenicPosition;
  deltaX: number;
  deltaY: number;
  width: number;
  height: number;
}): ScenicPosition {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return start;
  }

  // CSS background-position moves the image in the opposite direction as
  // its percentage increases when `cover` crops an oversized image. Subtract
  // pointer movement so the visible wallpaper follows the contributor's drag.
  return {
    x: clampAppearancePercentage(start.x - (deltaX / width) * 100, start.x),
    y: clampAppearancePercentage(start.y - (deltaY / height) * 100, start.y),
  };
}

export function serializeScenicPosition(position: ScenicPosition): string {
  return `${Number(position.x.toFixed(2))}% ${Number(position.y.toFixed(2))}%`;
}
