"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type LiveMatchCountValue = {
  count: number | null;
  report: (count: number) => void;
};

const LiveMatchCountContext = createContext<LiveMatchCountValue | null>(null);

/**
 * Lets a directory's overview panel keep telling the truth once its catalogue
 * filters live.
 *
 * The panel sits OUTSIDE the catalogue (it is the page's own aside), so its
 * "Matching Now" figure used to come from the same server query that filtered
 * the results. With filtering moved to the browser that figure would freeze at
 * whatever the URL's `?q=` produced, which is worse than not showing it. This
 * provider is the smallest thing that fixes it: the catalogue reports how many
 * records it is showing, the panel reads that number, and everything else about
 * either component is unchanged. Before hydration — and on any page that does
 * not use it — the panel simply renders its server-computed fallback.
 */
export function LiveMatchCountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState<number | null>(null);
  return (
    <LiveMatchCountContext.Provider value={{ count, report: setCount }}>
      {children}
    </LiveMatchCountContext.Provider>
  );
}

/** Publishes the current visible-match count, when a provider is present. */
export function useReportLiveMatchCount(count: number): void {
  const context = useContext(LiveMatchCountContext);
  const report = context?.report;

  useEffect(() => {
    report?.(count);
  }, [report, count]);
}

/** The live count, falling back to the server's own figure before hydration. */
export function LiveMatchCount({ fallback }: { fallback: number }) {
  const context = useContext(LiveMatchCountContext);
  return <>{context?.count ?? fallback}</>;
}
