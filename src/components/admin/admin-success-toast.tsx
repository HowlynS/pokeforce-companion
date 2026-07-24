"use client";

// Shared admin success toast (Admin Polish Pass 2, Part 3) — mounted once
// by AdminShell, so every admin page gets flash-message feedback for a
// successful mutation without each page needing its own banner/dictionary.
// The `?success=<code>` query param IS the flash message: every mutating
// server action's success redirect sets it (see success-messages.ts for
// the code -> text mapping), and this component is the ONLY place that
// consumes/removes it.
//
// Detection uses next/navigation's useSearchParams(), the one reactive
// hook that re-renders this component when a Server Action's redirect
// changes the URL's search string WITHOUT a full remount — AdminShell (and
// this toast inside it) is a persistent layout child that survives
// navigation between admin pages, so a mount-only effect would only ever
// see the very first page load, never a later same-route redirect. The
// cleanup WRITE (stripping `success` back out of the address bar once
// shown) deliberately uses the raw History API instead of next/navigation's
// router, mirroring RecordList's own established reasoning
// (src/components/admin/record-list.tsx): calling router.replace on these
// force-dynamic routes would trigger another real server round trip and a
// full workspace re-render purely to tidy up the URL, which is both
// wasteful and would flash the whole page for a cosmetic cleanup step.
//
// Never enters a form draft/snapshot (it renders nothing inside any
// <form>), never dirties AdminFormGuard (no shared state, no dispatched
// FORM_CHANGE_EVENT), and never touches the in-editor delete dialog's own
// event channel — it is a fully independent, presentation-only overlay.
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { adminSuccessMessage, removeSuccessParam } from "@/lib/admin/success-messages";

const AUTO_DISMISS_MS = 5000;

export function AdminSuccessToast() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const text = adminSuccessMessage(successParam);
    if (!text) {
      return;
    }
    // Deliberate: next/navigation's useSearchParams keeps returning this
    // same `success` value across renders because the URL cleanup below
    // uses the raw History API (see this file's own module comment for
    // why), which Next's router state never observes. Local `message`
    // state is therefore the ONLY thing that lets auto/manual dismissal
    // actually hide the toast — deriving it straight from `successParam`
    // during render would make it reappear on every re-render for the
    // rest of this page's lifetime.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(text);

    // Consume-and-remove: the address bar no longer shows `success` once
    // it has been read, so a later refresh never re-shows the same toast.
    if (typeof window !== "undefined") {
      const suffix = removeSuccessParam(window.location.search);
      const nextUrl = `${pathname}${suffix}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [successParam, pathname, searchParams]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div className="admin-toast-viewport">
      <div className="admin-toast">
        {/* role="status"/aria-live scoped to the message text alone, never
            the whole card — the dismiss button is an interactive control,
            not part of the announced text, and nesting it inside the live
            region would make its own accessible name (and any query
            matching this role) pick up stray button text alongside the
            actual message. Mirrors AdminFormGuard's own identical
            reasoning for keeping role="status" off a container that holds
            more than just the live text (see that component's own comment). */}
        <span role="status" aria-live="polite" className="admin-toast-message">
          {message}
        </span>
        <button
          type="button"
          className="admin-toast-dismiss"
          aria-label="Dismiss"
          onClick={() => setMessage(null)}
        >
          &times;
        </button>
      </div>
    </div>
  );
}
