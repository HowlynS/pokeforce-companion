"use client";

import Link from "next/link";
import { useState } from "react";
import type { WorldLocationNode } from "@/lib/world/world-tree";

type WorldTreeProps = {
  nodes: readonly WorldLocationNode[];
  selectedId: string;
  /** Ids the current selection requires to be revealed (its own path). */
  expandedIds: readonly string[];
  /** Preserved on every node link so filtering survives navigation. */
  query: string;
};

type WorldTreeNodesProps = {
  nodes: readonly WorldLocationNode[];
  selectedId: string;
  isOpen: (id: string) => boolean;
  onToggle: (id: string, open: boolean) => void;
  query: string;
};

function nodeHref(slug: string, query: string): string {
  const params = new URLSearchParams();
  params.set("location", slug);
  if (query) params.set("q", query);
  return `/world?${params.toString()}`;
}

/**
 * The handoff's region tree.
 *
 * Branch disclosure used to be a native `<details>`/`<summary>` pair. Two
 * requirements retired that shape:
 *
 * 1. Hit-area ownership. A `<summary>` owns the whole row, so the row's
 *    padding activated the disclosure while only the inner text line
 *    navigated — the visible bubble was larger than the real link. Now the row
 *    is a bare flex wrapper with no padding of its own: the disclosure
 *    `<button>` and the Location `<a>` carry the entire row's padding
 *    themselves, so every pixel of the highlighted rectangle belongs to a real
 *    control (no invisible overlay, no fake hit area).
 * 2. Motion. `<details>` hides its content outright, so a collapse can never
 *    animate. The branch wrapper is always rendered and animates through the
 *    CSS `grid-template-rows: 0fr → 1fr` technique instead (never a fake
 *    `max-height`), and is made `visibility: hidden` at the end of the
 *    collapse so collapsed rows stay out of the tab order.
 *
 * Selection is still a real URL (`?location=`) on a server-rendered page.
 * Only disclosure state is client-side, and it is deliberately sticky: a
 * branch opens when the visitor opens it or when a selection reveals it, and
 * closes only when the visitor closes it. Soft navigation keeps this
 * component mounted, so selecting another Location never collapses the branch
 * the visitor is currently working through.
 *
 * Depth is whatever the real containment chain has. The handoff's three fixed
 * levels only drive styling: level 0 is the region row, level 1 the nested
 * row, and level 2+ reuse the leaf treatment.
 */
function WorldTreeNodes({
  nodes,
  selectedId,
  isOpen,
  onToggle,
  query,
}: WorldTreeNodesProps) {
  return (
    <ul className="world-tree-list">
      {nodes.map((node) => {
        const level = Math.min(node.depth, 2);
        const selected = node.id === selectedId;
        const hasChildren = node.children.length > 0;
        const open = hasChildren && isOpen(node.id);
        const rowClassName =
          `world-tree-row world-tree-row--level-${level}` +
          (hasChildren ? "" : " world-tree-row--leaf") +
          (open ? " world-tree-row--open" : "") +
          (selected ? " world-tree-row--selected" : "");

        return (
          <li key={node.id}>
            <div className={rowClassName}>
              {hasChildren ? (
                <button
                  type="button"
                  className="world-tree-toggle"
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
                  onClick={() => onToggle(node.id, !open)}
                >
                  <span className="world-tree-chevron" aria-hidden="true">
                    <svg
                      width={level === 0 ? 10 : 9}
                      height={level === 0 ? 10 : 9}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M8 5l8 7-8 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>
              ) : null}
              <Link
                href={nodeHref(node.slug, query)}
                className="world-tree-label"
                aria-current={selected ? "true" : undefined}
              >
                {node.name}
              </Link>
            </div>

            {hasChildren ? (
              <div
                className={
                  "world-tree-branch" + (open ? " world-tree-branch--open" : "")
                }
              >
                <div className="world-tree-branch-inner">
                  <WorldTreeNodes
                    nodes={node.children}
                    selectedId={selectedId}
                    isOpen={isOpen}
                    onToggle={onToggle}
                    query={query}
                  />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function WorldTree({
  nodes,
  selectedId,
  expandedIds,
  query,
}: WorldTreeProps) {
  // Disclosure is sticky and additive: a branch opens when the visitor opens
  // it or when a selection reveals it, and closes only when the visitor
  // closes it. Selecting a sibling therefore never collapses the branch the
  // visitor is currently working through. The initial value matches the
  // server's own markup, so hydration is stable.
  const [state, setState] = useState<{
    selectedId: string;
    open: ReadonlySet<string>;
  }>(() => ({ selectedId, open: new Set(expandedIds) }));

  if (state.selectedId !== selectedId) {
    // Setting state while rendering this same component is React's supported
    // way to adjust state from props without an extra commit.
    const open = new Set(state.open);
    for (const id of expandedIds) open.add(id);
    setState({ selectedId, open });
  }

  const isOpen = (id: string) => state.open.has(id);

  function onToggle(id: string, open: boolean) {
    setState((current) => {
      const next = new Set(current.open);
      if (open) next.add(id);
      else next.delete(id);
      return { ...current, open: next };
    });
  }

  return (
    <nav aria-label="World locations" className="world-tree">
      <WorldTreeNodes
        nodes={nodes}
        selectedId={selectedId}
        isOpen={isOpen}
        onToggle={onToggle}
        query={query}
      />
    </nav>
  );
}
