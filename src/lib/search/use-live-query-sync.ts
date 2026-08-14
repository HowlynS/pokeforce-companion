"use client";

import { useEffect, useRef, useState } from "react";
import { cataloguePageHref } from "@/lib/catalogue-query";

/**
 * The live filter's own text, seeded from the URL and re-seeded whenever the
 * URL's own query changes underneath it.
 *
 * The re-seed matters because these catalogues stay mounted across a soft
 * navigation within the same route: a "Clear"/"Reset filters" link, a filter
 * popover, or the browser's Back button all re-render the page with a
 * different `?q=` while this component keeps its state. Without adopting the
 * new seed the field would keep filtering by a term the URL no longer has.
 * The component's own debounced URL writes never trip this, because they do
 * not re-render the server component that supplies the seed.
 */
export function useLiveQueryState(
  seed: string,
): [string, (next: string) => void, boolean] {
  const [state, setState] = useState({ seed, query: seed });
  const reseeded = state.seed !== seed;

  if (reseeded) {
    // Setting state while rendering this same component is React's supported
    // way to adjust state from props without an extra commit.
    setState({ seed, query: seed });
  }

  const query = reseeded ? seed : state.query;
  return [
    query,
    (next: string) => setState((current) => ({ ...current, query: next })),
    reseeded,
  ];
}

/** How long the URL lags behind the field. The visible result set is never
    debounced — only this write is — so the catalogue updates on every
    keystroke while the address bar settles once typing pauses. */
export const LIVE_QUERY_SYNC_DELAY_MS = 120;

type LiveQuerySyncOptions = {
  basePath: string;
  query: string;
  /** Page number; only values above 1 reach the URL, matching
      cataloguePageHref's existing rule. */
  page?: number;
  /** Every other live parameter (category/type/profession filters, the World's
      selected location). Values are passed through unchanged. */
  params?: Record<string, string | string[] | undefined>;
};

/**
 * Keeps the address bar in step with a live filter WITHOUT navigating.
 *
 * `history.replaceState` is used rather than `router.push`/`router.replace`
 * for three reasons the brief calls for: these pages are `force-dynamic`, so a
 * router navigation would be a full server round trip per keystroke; replacing
 * rather than pushing keeps one history entry for a whole search instead of
 * one per character; and Next.js supports a direct `history.replaceState` for
 * exactly this case (updating search params without a request). Reloading or
 * sharing the resulting URL still hits the server, which reads `?q=` and
 * renders the same filtered state.
 */
export function useLiveQuerySync({
  basePath,
  query,
  page = 1,
  params,
}: LiveQuerySyncOptions): void {
  const href = cataloguePageHref(basePath, page, {
    ...params,
    q: query.trim() || undefined,
  });
  // The first effect run must not rewrite the URL the visitor arrived on:
  // that would strip a parameter this page does not know about.
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    if (lastWritten.current === null) {
      lastWritten.current = href;
      return;
    }
    if (lastWritten.current === href) return;

    const timer = setTimeout(() => {
      lastWritten.current = href;
      window.history.replaceState(null, "", href);
    }, LIVE_QUERY_SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [href]);
}
