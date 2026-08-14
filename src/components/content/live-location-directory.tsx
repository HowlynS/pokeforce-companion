"use client";

import { Fragment, type ReactNode } from "react";
import {
  LiveFilterResetProvider,
  LiveResetLink,
} from "@/components/content/live-filter-reset";
import { LiveSearchField } from "@/components/content/live-search-field";
import { LocationDirectoryFold } from "@/components/content/location-directory-fold";
import {
  filterLiveGroups,
  normalizeLiveQuery,
  type LiveFilterEntry,
} from "@/lib/search/live-filter";
import {
  useLiveQueryState,
  useLiveQuerySync,
} from "@/lib/search/use-live-query-sync";

export type LiveDirectoryEntry = LiveFilterEntry & { node: ReactNode };

export type LiveDirectoryGroup = {
  key: string;
  title: string;
  href?: string;
  countNoun?: string;
  /** The root region's own name, when the heading is itself a record that can
      match the query (Locations). Omitted for Shops, whose region heading is
      pure grouping. */
  headingText?: string;
  subGroups: {
    key: string;
    title: string;
    entries: LiveDirectoryEntry[];
  }[];
};

type LiveLocationDirectoryProps = {
  search: {
    basePath: string;
    placeholder: string;
    ariaLabel?: string;
    submitLabel?: string;
    initialQuery: string;
    preserve?: Record<string, string | string[] | undefined>;
  };
  toolbarExtra?: ReactNode;
  /** Shops keeps its "Clear" escape hatch beside the field. */
  showClearLink?: boolean;
  /** Shops' live "Showing N shops matching …" line; omitted for Locations. */
  summaryNoun?: string;
  toolbarClassName?: string;
  groupsClassName: string;
  gridClassName: string;
  groups: LiveDirectoryGroup[];
  emptyState: ReactNode;
};

/**
 * The live counterpart of DirectoryViewToggle for the two HIERARCHICAL public
 * directories (Locations, Shops), which present folds by root region and type
 * rather than a flat grid, and have no Grid/List switch to preserve.
 *
 * It shares every rule with the flat catalogue — one query state, filtering on
 * the keystroke over server-rendered nodes, debounced `history.replaceState`
 * URL sync, the page's own empty state shown live — and differs only in shape:
 * filtering runs through filterLiveGroups, so an emptied type band disappears
 * and a region survives when its own name matches, exactly as the server
 * previously decided. The fold components themselves are untouched, so their
 * disclosure state and entrance motion are unchanged.
 */
export function LiveLocationDirectory({
  search,
  toolbarExtra,
  showClearLink,
  summaryNoun,
  toolbarClassName,
  groupsClassName,
  gridClassName,
  groups,
  emptyState,
}: LiveLocationDirectoryProps) {
  const [query, setQuery] = useLiveQueryState(search.initialQuery);
  const normalized = normalizeLiveQuery(query);

  useLiveQuerySync({
    basePath: search.basePath,
    query,
    params: search.preserve,
  });

  const filtered = filterLiveGroups(groups, normalized);
  const groupsByKey = new Map(groups.map((group) => [group.key, group]));
  const subGroupTitle = new Map(
    groups.flatMap((group) =>
      group.subGroups.map(
        (subGroup) => [`${group.key}:${subGroup.key}`, subGroup.title] as const,
      ),
    ),
  );
  const matchCount = filtered.reduce((total, group) => total + group.matchCount, 0);

  return (
    <LiveFilterResetProvider reset={() => setQuery("")}>
      <div className={toolbarClassName ?? "directory-toolbar"}>
        <div className="directory-toolbar-left">
          <LiveSearchField
            basePath={search.basePath}
            placeholder={search.placeholder}
            ariaLabel={search.ariaLabel}
            submitLabel={search.submitLabel}
            value={query}
            onChange={setQuery}
            preserve={search.preserve}
          />
          {toolbarExtra}
          {showClearLink && query.trim() ? (
            <LiveResetLink
              href={search.basePath}
              className="shops-directory-clear"
              queryOnly
            >
              Clear
            </LiveResetLink>
          ) : null}
        </div>
      </div>

      {summaryNoun && query.trim() && matchCount > 0 ? (
        <p className="shops-directory-summary" aria-live="polite">
          Showing {matchCount} {matchCount === 1 ? summaryNoun : `${summaryNoun}s`}{" "}
          matching &quot;{query.trim()}&quot;.
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <div className={groupsClassName}>
          {filtered.map((group) => {
            const source = groupsByKey.get(group.key);
            if (!source) return null;

            return (
              <LocationDirectoryFold
                key={group.key}
                title={source.title}
                variant="region"
                href={source.href}
                count={group.matchCount}
                countNoun={source.countNoun}
              >
                {group.subGroups.map((subGroup) => (
                  <LocationDirectoryFold
                    key={subGroup.key}
                    title={subGroupTitle.get(`${group.key}:${subGroup.key}`) ?? ""}
                    variant="type"
                  >
                    <div className={gridClassName}>
                      {subGroup.entries.map((entry) => (
                        <Fragment key={entry.key}>{entry.node}</Fragment>
                      ))}
                    </div>
                  </LocationDirectoryFold>
                ))}
              </LocationDirectoryFold>
            );
          })}
        </div>
      ) : (
        emptyState
      )}
    </LiveFilterResetProvider>
  );
}
