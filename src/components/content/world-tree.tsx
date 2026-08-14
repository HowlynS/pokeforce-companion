"use client";

import Link from "next/link";
import { useState } from "react";
import { LiveSearchField } from "@/components/content/live-search-field";
import { normalizeLiveQuery } from "@/lib/search/live-filter";
import {
  useLiveQueryState,
  useLiveQuerySync,
} from "@/lib/search/use-live-query-sync";
import {
  filterWorldTree,
  flattenWorldTree,
  type WorldLocationNode,
} from "@/lib/world/world-tree";

type WorldSidebarProps = {
  /** The COMPLETE containment tree — filtering happens here, in the browser. */
  nodes: readonly WorldLocationNode[];
  selectedId: string;
  selectedSlug: string;
  /** Ids the current selection requires to be revealed (its own path). */
  expandedIds: readonly string[];
  initialQuery: string;
};

type WorldTreeProps = {
  nodes: readonly WorldLocationNode[];
  selectedId: string;
  /** Ids the current selection requires to be revealed (its own path). */
  expandedIds: readonly string[];
  /** Preserved on every node link so filtering survives navigation. */
  query: string;
  /** Branches a live filter needs open to show its matches in context. */
  revealedIds?: ReadonlySet<string>;
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

function WorldTree({
  nodes,
  selectedId,
  expandedIds,
  query,
  revealedIds,
}: WorldTreeProps) {
  // Disclosure is sticky and additive: a branch opens when the visitor opens
  // it or when a selection reveals it, and closes only when the visitor
  // closes it. Selecting a sibling therefore never collapses the branch the
  // visitor is currently working through. The initial value matches the
  // server's own markup, so hydration is stable.
  const [state, setState] = useState<{
    selectedId: string;
    open: ReadonlySet<string>;
    /** Branches the visitor closed by hand. Kept apart from `open` so an
        explicit collapse also wins over a filter's own reveal. */
    collapsed: ReadonlySet<string>;
  }>(() => ({ selectedId, open: new Set(expandedIds), collapsed: new Set() }));

  if (state.selectedId !== selectedId) {
    // Setting state while rendering this same component is React's supported
    // way to adjust state from props without an extra commit.
    const open = new Set(state.open);
    const collapsed = new Set(state.collapsed);
    for (const id of expandedIds) {
      open.add(id);
      collapsed.delete(id);
    }
    setState({ selectedId, open, collapsed });
  }

  // A branch a live filter needs open is shown open WITHOUT being written into
  // the visitor's own disclosure set, so clearing the filter restores exactly
  // the tree they had before typing.
  const isOpen = (id: string) =>
    !state.collapsed.has(id) &&
    (state.open.has(id) || Boolean(revealedIds?.has(id)));

  function onToggle(id: string, open: boolean) {
    setState((current) => {
      const nextOpen = new Set(current.open);
      const nextCollapsed = new Set(current.collapsed);
      if (open) {
        nextOpen.add(id);
        nextCollapsed.delete(id);
      } else {
        nextOpen.delete(id);
        nextCollapsed.add(id);
      }
      return { ...current, open: nextOpen, collapsed: nextCollapsed };
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

/**
 * The World sidebar: filter field, label, and tree as ONE client surface.
 *
 * The field has to live here rather than beside the tree, because live
 * filtering means the query is component state — a field rendered by the
 * server would either lose focus on every keystroke or need a round trip to
 * change what the tree shows. Filtering itself reuses `filterWorldTree`, the
 * same pure function the server used, so the ancestor-preserving semantics are
 * unchanged: a deep match keeps its whole containment chain visible rather
 * than being flattened to the matching node alone.
 */
export function WorldSidebar({
  nodes,
  selectedId,
  selectedSlug,
  expandedIds,
  initialQuery,
}: WorldSidebarProps) {
  const [query, setQuery] = useLiveQueryState(initialQuery);
  const trimmed = query.trim();

  useLiveQuerySync({
    basePath: "/world",
    query,
    params: { location: selectedSlug },
  });

  const visibleTree = filterWorldTree(nodes, trimmed);
  // Every branch left standing by the filter is a branch on the way to a
  // match, so revealing exactly those shows each match in context without
  // touching the visitor's own disclosure state.
  const revealedIds = normalizeLiveQuery(query)
    ? new Set(
        flattenWorldTree(visibleTree)
          .filter((node) => node.children.length > 0)
          .map((node) => node.id),
      )
    : undefined;

  return (
    <>
      <div className="world-sidebar-search">
        <LiveSearchField
          basePath="/world"
          placeholder="Filter locations..."
          ariaLabel="Filter locations"
          submitLabel="Filter locations"
          value={query}
          onChange={setQuery}
          preserve={{ location: selectedSlug }}
        />
      </div>
      <p className="world-sidebar-label">Regions</p>
      {visibleTree.length > 0 ? (
        <WorldTree
          nodes={visibleTree}
          selectedId={selectedId}
          expandedIds={expandedIds}
          query={trimmed}
          revealedIds={revealedIds}
        />
      ) : (
        <p className="world-sidebar-empty">
          No locations match <strong>{trimmed}</strong>.{" "}
          <button
            type="button"
            className="world-sidebar-clear"
            onClick={() => setQuery("")}
          >
            Clear the filter
          </button>
          .
        </p>
      )}
    </>
  );
}
