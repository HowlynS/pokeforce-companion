import { Fragment, type ReactNode } from "react";

type CatalogueViewSwitchProps = {
  mode: "grid" | "list";
  grid: ReactNode;
  list: ReactNode;
};

/**
 * Renders whichever of a catalogue's two server-rendered views is currently
 * selected, keyed by the mode itself.
 *
 * The key is the whole point. Both views wrap their rows in the same element
 * shape (a container `<div>` holding one keyed `<a>` per record), so without
 * it React reconciles grid against list position-by-position, keeps the
 * existing DOM nodes, and only swaps their className — which never restarts
 * the shared `cx-item-in` entrance animation those rows carry. Keying the
 * rendered subtree by mode makes React unmount the outgoing view and mount
 * fresh nodes for the incoming one, so the same stagger the directory plays
 * on first render plays again on every switch.
 *
 * The key is deliberately scoped to the presentation subtree only: toolbars,
 * search fields, filter popovers, disclosure state, and pagination all render
 * outside it and keep their state across a switch. Under
 * prefers-reduced-motion the entrance rules simply do not apply, so a switch
 * still swaps instantly with no animation and no flicker.
 */
export function CatalogueViewSwitch({
  mode,
  grid,
  list,
}: CatalogueViewSwitchProps) {
  return <Fragment key={mode}>{mode === "grid" ? grid : list}</Fragment>;
}
