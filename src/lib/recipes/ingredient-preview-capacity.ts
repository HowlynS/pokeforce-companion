/**
 * How many complete ingredient previews fit in a strip, and whether a
 * disclosure trigger is needed beside them.
 *
 * Pure geometry, deliberately separated from the DOM so it can be reasoned
 * about and tested directly: the caller measures, this decides.
 *
 * The rule is "complete cells only" — a preview is either fully visible or
 * not rendered at all, never clipped. When everything fits there is no
 * trigger, so the strip's whole width is available; the moment it does not,
 * the trigger's own cell plus one gap is reserved before recounting.
 */
export type IngredientCapacityInput = {
  /** Usable inner width of the preview strip, in px. */
  available: number;
  /** One preview cell's width, in px. Grid preview chips are fixed squares. */
  cellWidth: number;
  /** Horizontal gap between adjacent cells, in px. */
  gap: number;
  /** The disclosure trigger's own width, in px. */
  triggerWidth: number;
  /** How many ingredients the Recipe actually has. */
  total: number;
};

export type IngredientCapacity = {
  /** How many previews to render. Always at least 1 when there is any. */
  visible: number;
  /** Whether the disclosure trigger must be rendered beside them. */
  showTrigger: boolean;
};

/** How many whole cells fit in `width`, counting the gaps between them. */
function wholeCellsWithin(width: number, cellWidth: number, gap: number) {
  if (cellWidth <= 0) return 0;
  // n cells occupy n*cell + (n-1)*gap, so solving for n gives this form.
  return Math.floor((width + gap) / (cellWidth + gap));
}

export function resolveIngredientCapacity({
  available,
  cellWidth,
  gap,
  triggerWidth,
  total,
}: IngredientCapacityInput): IngredientCapacity {
  if (total <= 0) return { visible: 0, showTrigger: false };

  // First ask the generous question: with no trigger to make room for, does
  // the whole set fit? If so the strip needs no disclosure at all.
  if (wholeCellsWithin(available, cellWidth, gap) >= total) {
    return { visible: total, showTrigger: false };
  }

  // It does not, so the trigger is going to be rendered; it gets its own
  // cell and one gap before the previews are counted again.
  const withoutTrigger = available - triggerWidth - gap;
  const fitted = wholeCellsWithin(withoutTrigger, cellWidth, gap);

  // Never render zero previews: a strip showing only a chevron communicates
  // nothing about the Recipe. One clipped-tight preview beats none.
  const visible = Math.min(Math.max(fitted, 1), total);

  // Reserving the trigger can, in a very narrow strip, drop capacity to the
  // point that the full set would have fitted without it after all.
  if (visible >= total) return { visible: total, showTrigger: false };

  return { visible, showTrigger: true };
}
