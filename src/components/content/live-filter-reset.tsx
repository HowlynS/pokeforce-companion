"use client";

import { createContext, useContext, type ReactNode } from "react";

const LiveFilterResetContext = createContext<(() => void) | null>(null);

export function LiveFilterResetProvider({
  reset,
  children,
}: {
  reset: () => void;
  children: ReactNode;
}) {
  return (
    <LiveFilterResetContext.Provider value={reset}>
      {children}
    </LiveFilterResetContext.Provider>
  );
}

type LiveResetLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  /** True when the search term is the ONLY thing this link clears. A link that
      also has to drop a server-side filter (an Item Category, a Location Type)
      must still navigate, because that filter decides which records the page
      loaded in the first place. */
  queryOnly: boolean;
};

/**
 * "Clear" / "Reset search" — a real link that resets the live filter in place.
 *
 * A plain `<Link>` is not enough once filtering is client state. The URL is
 * kept in step with `history.replaceState`, which deliberately does not run a
 * navigation, so the router can believe it is already at the unfiltered URL
 * and treat a click on that link as a no-op — leaving the visitor looking at
 * filtered results under an unfiltered address. Resetting the state directly,
 * and letting the existing URL sync write the address back, is both correct
 * and instant. The element stays an anchor with a real href, so it is still a
 * link to assistive tech and still works with JavaScript unavailable.
 */
export function LiveResetLink({
  href,
  className,
  children,
  queryOnly,
}: LiveResetLinkProps) {
  const reset = useContext(LiveFilterResetContext);

  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (!queryOnly || !reset) return;
        event.preventDefault();
        reset();
      }}
    >
      {children}
    </a>
  );
}
