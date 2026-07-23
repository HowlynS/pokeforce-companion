"use client";

// Shared admin editor form guard (Opus Pass 2). The one client controller
// that gives a participating create/edit <form> its unsaved-changes
// protection, draft persistence, keyboard saving, and save-state feedback
// — WITHOUT converting the page (or the admin layout) to a client app.
//
// It renders the sticky actions row itself (the same `.admin-editor-actions`
// markup EditorActions produces — Cancel link + Save button — plus a
// restrained live save-status), so it is a drop-in replacement for
// EditorActions on the forms that opt in. It attaches to its OWN <form> via
// `rootRef.current.closest("form")` (never a brittle global id lookup), and
// every document-level listener it needs (capture-phase link interception,
// popstate, beforeunload, Ctrl/Cmd+S) is added on mount and removed on
// unmount — nothing leaks, and nothing is monkey-patched.
//
// Dirty detection is a MEANINGFUL comparison (form-snapshot): a baseline is
// captured once on mount, and every input/change — plus a short deferred
// pass, so programmatic sibling updates like Name -> Page-address sync are
// caught — recomputes a normalized snapshot and compares it to the
// baseline. Edit-then-revert returns to clean.
//
// Save success detection is grounded in real lifecycle, never a blind
// timeout: the server actions redirect on success (to a different route,
// unmounting this guard) and on validation error (back to the same route,
// where useFormStatus's `pending` returns to false with the page still
// mounted). Drafts are cleared on a detected successful submit and kept on
// failure.

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  draftableValues,
  snapshotFormData,
  snapshotsEqual,
  type FormSnapshot,
} from "@/lib/admin/form-snapshot";
import {
  createDraft,
  readDraft,
  removeDraft,
  writeDraft,
  type AdminDraft,
} from "@/lib/admin/form-draft";
import { FORM_CHANGE_EVENT } from "@/lib/admin/form-change-event";
import { dispatchSlugRestore } from "@/lib/admin/slug-restore-event";

const DRAFT_DEBOUNCE_MS = 400;
// Defense-in-depth only. The deterministic path is the shared
// FORM_CHANGE_EVENT that RecordSlugField / DateField dispatch the moment
// they programmatically change a value (see form-change-event.ts), plus the
// native input/change events every user edit fires. This short trailing
// recompute remains ONLY as a safety net for any future field that mutates
// a value without emitting either signal — it is never the primary
// mechanism, and removing every instrumented case would not break dirty
// detection.
const DEFERRED_RECOMPUTE_MS = 60;

type PendingNavigation =
  | { type: "href"; href: string }
  | { type: "back" };

type AdminFormGuardProps = {
  submitLabel: string;
  cancelHref: string;
  cancelLabel?: string;
  savingLabel?: string;
  /** Immutable/technical field names excluded from dirty comparison (record
      id, originalSlug, and the verification picker, which is a no-op unless
      the opt-in checkbox is checked). "$"-prefixed framework fields are
      always excluded. */
  excludeFields?: readonly string[];
  /** Stable, record-isolated draft key (e.g. "item:edit:<id>:item-edit-form").
      Omit to disable draft persistence for this form. */
  draftKey?: string;
  /** The server record's updatedAt (ISO) at load, for stale-server
      detection on the recovery prompt. Edit forms only. */
  serverUpdatedAt?: string | null;
  /** "surface" (default): the sticky, `.admin-editor-surface`-toned actions
      footer every full editor page uses. "inline": a plain, non-sticky row
      with no surface background/border of its own — for a form that lives
      directly inside an existing card (currently the Game Versions
      overview's inline Create form) rather than its own `.admin-editor-
      surface` panel, where the sticky footer's own `--color-surface`
      background read as a visually detached darker rectangle against the
      card's lighter `--color-surface-raised` tone. Only the CSS class
      differs — every behavior (dirty tracking, drafts, navigation,
      Ctrl/Cmd+S, save lifecycle) is identical in both modes. */
  layout?: "surface" | "inline";
};

function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  // Dispatch input + change so React-controlled fields (Name, Page
  // address) update their own state, and uncontrolled fields (select,
  // textarea) notify any listeners (e.g. the autosize textarea).
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function AdminFormGuard({
  submitLabel,
  cancelHref,
  cancelLabel = "Cancel",
  savingLabel = "Saving…",
  excludeFields = [],
  draftKey,
  serverUpdatedAt,
  layout = "surface",
}: AdminFormGuardProps) {
  const { pending } = useFormStatus();
  const router = useRouter();

  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const baselineRef = useRef<FormSnapshot | null>(null);
  const excludeRef = useRef<readonly string[]>(excludeFields);
  const draftKeyRef = useRef<string | undefined>(draftKey);
  const serverUpdatedAtRef = useRef<string | null | undefined>(serverUpdatedAt);

  const dirtyRef = useRef(false);
  const submittingRef = useRef(false);
  const bypassNavRef = useRef(false);
  const sentinelActiveRef = useRef(false);
  const sentinelIdRef = useRef<number | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLinkRef = useRef<HTMLAnchorElement>(null);
  // Read by the document keydown handler to suppress Ctrl/Cmd+S while a
  // modal is open; kept in sync with the state below on every render.
  const pendingNavRef = useRef(false);
  const recoveryOpenRef = useRef(false);
  // The push-buffer helper, defined inside the mount effect and exposed here
  // so restoreDraft (which makes the form dirty) can arm the buffer.
  const pushSentinelRef = useRef<() => void>(() => {});

  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);
  const [recovery, setRecovery] = useState<{
    draft: AdminDraft;
    stale: boolean;
  } | null>(null);

  // Mirror the latest props/state into refs for the document-level
  // listeners — in an effect (never during render), so the listeners
  // always read current values without violating the refs-in-render rule.
  useEffect(() => {
    excludeRef.current = excludeFields;
    draftKeyRef.current = draftKey;
    serverUpdatedAtRef.current = serverUpdatedAt;
    submittingRef.current = pending;
    pendingNavRef.current = pendingNav !== null;
    recoveryOpenRef.current = recovery !== null;
  });

  useEffect(() => {
    const form = rootRef.current?.closest("form") ?? null;
    formRef.current = form;
    if (!form) {
      return;
    }

    const exclude = excludeRef.current;
    const key = draftKeyRef.current;

    const currentSnapshot = () =>
      snapshotFormData(new FormData(form), { exclude });

    // Baseline = the server-rendered form state, captured before any draft
    // restore, so revert-to-clean is measured against the real record.
    baselineRef.current = currentSnapshot();

    // --- History buffer -------------------------------------------------
    // A single extra history entry (same URL) that exists EXACTLY while the
    // form is dirty, so a Back press pops it (firing popstate without
    // leaving the page) and we can prompt. The invariant "buffer present
    // iff dirty" is what fixes the old defects: it is consumed on
    // revert-to-clean (so a now-clean Back leaves in one press), on every
    // discard navigation (so no orphan entry is left behind), and on submit
    // (so a successful save's history has no duplicate editor entry) — and
    // re-pushed if a submit turns out to have failed.
    const pushSentinel = () => {
      if (sentinelActiveRef.current || typeof history === "undefined") {
        return;
      }
      const id = Date.now();
      sentinelIdRef.current = id;
      try {
        history.pushState({ __pfGuard: id }, "");
        sentinelActiveRef.current = true;
      } catch {
        // history unavailable — link interception + beforeunload remain.
      }
    };

    const consumeSentinel = () => {
      if (!sentinelActiveRef.current || typeof history === "undefined") {
        return;
      }
      // Only pop when the top entry is provably OURS. If its state was
      // overwritten (e.g. by the record-list search's own replaceState),
      // leave it rather than risk popping a real navigation entry — a
      // stranded same-URL buffer is harmless, and keeping the flag set
      // prevents a second buffer stacking on top.
      if (
        (history.state as { __pfGuard?: number } | null)?.__pfGuard !==
        sentinelIdRef.current
      ) {
        return;
      }
      sentinelActiveRef.current = false;
      bypassNavRef.current = true; // the resulting popstate is our own
      history.back();
    };

    pushSentinelRef.current = pushSentinel;

    const setDirtyState = (value: boolean) => {
      if (dirtyRef.current === value) {
        return;
      }
      dirtyRef.current = value;
      setDirty(value);
      if (value) {
        pushSentinel();
      } else {
        // Reverted to clean: drop the buffer so a Back press leaves in a
        // single press instead of first consuming a dead entry.
        consumeSentinel();
      }
    };

    // RecordSlugField's own sync mode, read directly off the DOM (a plain
    // data-attribute, never part of FormData — see slug-restore-event.ts)
    // so it can be persisted as draft metadata without ever entering the
    // dirty-comparison snapshot above. Absent when the form has no
    // RecordSlugField.
    const readSlugSyncMode = (): "auto" | "manual" | undefined => {
      const slugInput = form.querySelector<HTMLInputElement>('input[name="slug"]');
      if (!slugInput) {
        return undefined;
      }
      return slugInput.dataset.slugSyncMode === "manual" ? "manual" : "auto";
    };

    const writeDraftNow = (submitted: boolean) => {
      if (!key) {
        return;
      }
      const snapshot = currentSnapshot();
      const values = draftableValues(snapshot);
      writeDraft(
        createDraft(
          { key, serverUpdatedAt: serverUpdatedAtRef.current ?? null },
          values,
          {
            ...(submitted ? { submittedAt: Date.now() } : {}),
            slugSyncMode: readSlugSyncMode(),
          }
        )
      );
    };

    const recompute = () => {
      const baseline = baselineRef.current;
      if (!baseline) {
        return;
      }
      const nextDirty = !snapshotsEqual(currentSnapshot(), baseline);
      setDirtyState(nextDirty);

      if (!key) {
        return;
      }
      if (nextDirty) {
        if (draftTimerRef.current) {
          clearTimeout(draftTimerRef.current);
        }
        draftTimerRef.current = setTimeout(() => writeDraftNow(false), DRAFT_DEBOUNCE_MS);
      } else {
        // Reverted to the exact server baseline: nothing to recover.
        if (draftTimerRef.current) {
          clearTimeout(draftTimerRef.current);
        }
        removeDraft(key);
      }
    };

    const onFormChange = () => {
      recompute();
      if (deferredTimerRef.current) {
        clearTimeout(deferredTimerRef.current);
      }
      deferredTimerRef.current = setTimeout(recompute, DEFERRED_RECOMPUTE_MS);
    };

    const onSubmit = () => {
      // A real submit fired (native validation already passed). The
      // submission MUST proceed untouched — any history.back() here or
      // concurrent with the in-flight action aborts the server-action POST,
      // and React 19 runs the action regardless of preventDefault. So this
      // handler only flushes the draft (with a submit marker, so a
      // validation-error reload can recover the exact submitted values and a
      // successful submit can be recognized and cleared on the next load).
      // The history buffer is neutralized separately, on the pending→true
      // transition (see the pending-watcher effect), where it is safe.
      submittingRef.current = true;
      writeDraftNow(true);
    };

    // --- Draft recovery on load -----------------------------------------
    if (key) {
      const draft = readDraft(key);
      if (draft) {
        const errorParam = new URLSearchParams(window.location.search).get(
          "error"
        );
        if (draft.submittedAt && !errorParam) {
          // The submit that wrote this draft succeeded (we are not on a
          // validation-error reload) — discard silently, no prompt.
          removeDraft(key);
        } else if (snapshotsEqual(draft.values, draftableValues(baselineRef.current!))) {
          // Draft already matches the loaded server state — nothing to do.
          removeDraft(key);
        } else {
          const stale =
            serverUpdatedAtRef.current != null &&
            draft.serverUpdatedAt != null &&
            draft.serverUpdatedAt !== serverUpdatedAtRef.current;
          setRecovery({ draft, stale });
        }
      }
    }

    // --- Listeners ------------------------------------------------------
    // input/change/FORM_CHANGE are listened for at the DOCUMENT, not the
    // form, then filtered to controls OWNED by this form — because the
    // image and verification controls render in the aside OUTSIDE the
    // <form> element and associate with it only via the standard HTML
    // `form=` attribute, so their events never bubble to the form itself. A
    // form-associated control exposes its owning form as `.form` (set by
    // both DOM nesting and the form= attribute), so `target.form === form`
    // catches every control that submits with this form, wherever it sits
    // in the DOM, and ignores every unrelated input on the page (the
    // record-list search box, other forms).
    const onDocChange = (event: Event) => {
      const target = event.target as
        | (Element & { form?: HTMLFormElement | null })
        | null;
      if (!target) {
        return;
      }
      const owner =
        "form" in target && target.form
          ? target.form
          : target.closest?.("form") ?? null;
      if (owner !== form) {
        return;
      }
      onFormChange();
    };

    document.addEventListener("input", onDocChange);
    document.addEventListener("change", onDocChange);
    // The deterministic programmatic-change signal (RecordSlugField auto-
    // sync, DateField hidden-value updates) — the primary path for changes
    // that emit no native input/change event.
    document.addEventListener(FORM_CHANGE_EVENT, onDocChange);
    form.addEventListener("submit", onSubmit);

    const onCaptureClick = (event: MouseEvent) => {
      if (submittingRef.current) {
        // Block competing navigation while a save is in flight.
        const anchor = (event.target as Element | null)?.closest?.("a[href]");
        if (anchor && dirtyRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (!dirtyRef.current || bypassNavRef.current) {
        return;
      }
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return; // let modified clicks (new tab, etc.) behave normally
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") {
        return; // target=_blank etc.
      }
      if (anchor.hasAttribute("download")) {
        return;
      }
      let url: URL;
      try {
        url = new URL(anchor.getAttribute("href")!, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) {
        return; // external
      }
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return; // same page (e.g. hash-only) — not leaving the editor
      }
      event.preventDefault();
      event.stopPropagation(); // beat Next's <Link> onClick
      setPendingNav({ type: "href", href: url.pathname + url.search + url.hash });
    };

    const onPopState = () => {
      if (bypassNavRef.current) {
        // A popstate WE caused (consumeSentinel / go(-2)): swallow it once.
        bypassNavRef.current = false;
        return;
      }
      if (submittingRef.current || !dirtyRef.current) {
        return;
      }
      // The user pressed Back and popped our buffer; the URL is back to this
      // page. The buffer is now gone — re-push one to stay put, and prompt.
      sentinelActiveRef.current = false;
      pushSentinel();
      setPendingNav({ type: "back" });
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || submittingRef.current) {
        return;
      }
      writeDraftNow(false); // capture the latest values before a reload/close
      event.preventDefault();
      event.returnValue = ""; // triggers the browser's native warning
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveCombo =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        (event.key === "s" || event.key === "S");
      if (!isSaveCombo) {
        return;
      }
      // Always prevent the browser's Save Page dialog on an editor route.
      event.preventDefault();
      if (
        submittingRef.current ||
        pendingNavRef.current ||
        recoveryOpenRef.current
      ) {
        return; // saving, or a modal is open
      }
      if (!form.checkValidity()) {
        form.reportValidity(); // focus/scroll the first invalid field
        return;
      }
      const submitButton = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );
      form.requestSubmit(submitButton ?? undefined);
    };

    document.addEventListener("click", onCaptureClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("input", onDocChange);
      document.removeEventListener("change", onDocChange);
      document.removeEventListener(FORM_CHANGE_EVENT, onDocChange);
      form.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", onCaptureClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("keydown", onKeyDown);
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
      if (deferredTimerRef.current) {
        clearTimeout(deferredTimerRef.current);
      }
      // A successful save unmounts this guard while a submit was in flight
      // — clear the draft so a later load shows no recovery prompt.
      if (submittingRef.current && draftKeyRef.current) {
        removeDraft(draftKeyRef.current);
      }
    };
    // Mount-only: all live values are read through refs inside the closures.
  }, []);

  function closePendingNav() {
    setPendingNav(null);
  }

  function confirmDiscardNavigation() {
    const nav = pendingNav;
    setPendingNav(null);
    if (draftKeyRef.current) {
      removeDraft(draftKeyRef.current);
    }
    dirtyRef.current = false;
    setDirty(false);
    sentinelActiveRef.current = false;
    bypassNavRef.current = true;
    if (nav?.type === "back") {
      // History at this point (a back-prompt re-pushed the buffer in
      // onPopState): [..., prev, editor, buffer], current = buffer. go(-2)
      // reaches `prev` in one step. The single popstate this fires is
      // swallowed by onPopState (bypassNavRef is set, and it resets the
      // flag itself), so no re-prompt and no accumulated entry.
      history.go(-2);
    } else if (nav?.type === "href") {
      // The buffer sits at the current top; router.push replaces forward
      // history and reaches the destination once. No popstate fires here,
      // so the bypass flag is cleared on the next tick in case the guard
      // has not yet unmounted.
      router.push(nav.href);
      setTimeout(() => {
        bypassNavRef.current = false;
      }, 0);
    }
  }

  function restoreDraft() {
    const form = formRef.current;
    const current = recovery;
    setRecovery(null);
    if (!form || !current) {
      return;
    }
    const values = current.draft.values;
    const exclude = new Set(excludeRef.current);
    // RecordSlugField's own sync mode (auto/manual) at draft-write time —
    // draft-level metadata, never part of `values` (see slug-restore-event.ts
    // and form-draft.ts). Missing (e.g. a draft written before this field
    // existed, or a form with no RecordSlugField) defaults to "auto", the
    // common case and the safer of the two to assume.
    const slugManual = current.draft.slugSyncMode === "manual";
    for (const element of Array.from(form.elements)) {
      const named = element as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement;
      const name = named.name;
      if (!name || exclude.has(name) || name.startsWith("$")) {
        continue;
      }
      if (name === "slug") {
        // RecordSlugField's onChange treats ANY change event as a
        // deliberate manual edit — restoring through setNativeValue's
        // native input/change dispatch (like every other field below)
        // would incorrectly force manual mode even for a draft that was
        // still auto-syncing. Applying the value through this dedicated
        // event lets the field itself decide, from the explicit `manual`
        // flag, without going through that handler at all.
        const desired = values.slug?.[0] ?? "";
        dispatchSlugRestore(named, { value: desired, manual: slugManual });
        continue;
      }
      if (
        named instanceof HTMLInputElement &&
        (named.type === "checkbox" || named.type === "radio")
      ) {
        const desired = (values[name] ?? []).includes(named.value);
        if (named.checked !== desired) {
          named.checked = desired;
          named.dispatchEvent(new Event("input", { bubbles: true }));
          named.dispatchEvent(new Event("change", { bubbles: true }));
        }
        continue;
      }
      if (named instanceof HTMLInputElement && named.type === "file") {
        continue; // a file cannot be restored — never fake one
      }
      const desired = values[name]?.[0] ?? "";
      if (named.value !== desired) {
        setNativeValue(named, desired);
      }
    }
    // Restored values differ from baseline -> the form is now dirty, so the
    // history buffer must exist for Back interception. (The dispatched
    // events above also drive recompute, but set the state explicitly and
    // push the buffer here so it holds even if a field emitted no event.)
    dirtyRef.current = true;
    setDirty(true);
    pushSentinelRef.current();
  }

  /** Explicit "Discard draft" button: drops the stored draft, keeping the
      loaded server values. */
  function discardDraft() {
    setRecovery(null);
    if (draftKeyRef.current) {
      removeDraft(draftKeyRef.current);
    }
  }

  /** Escape / backdrop on the recovery prompt: close WITHOUT deleting the
      draft, so closing without choosing preserves the user's work. */
  function dismissRecovery() {
    setRecovery(null);
  }

  const statusText = pending
    ? savingLabel
    : dirty
      ? "Unsaved changes"
      : "";

  return (
    <>
      <div
        ref={rootRef}
        className={
          layout === "inline"
            ? "admin-editor-actions admin-editor-actions--inline"
            : "admin-editor-actions"
        }
      >
        <a
          ref={cancelLinkRef}
          href={cancelHref}
          className="btn btn-cancel"
          aria-disabled={pending ? "true" : undefined}
          onClick={(event) => {
            if (pending) {
              event.preventDefault();
            }
            // When dirty (and not saving), the document capture listener
            // has already intercepted this click and opened the modal.
          }}
        >
          {cancelLabel}
        </a>

        <button
          type="submit"
          className="btn btn-primary admin-editor-submit"
          disabled={pending}
        >
          <Save aria-hidden="true" className="admin-editor-submit-icon" />
          {pending ? savingLabel : submitLabel}
        </button>

        {/* aria-live alone (no role="status") makes this a live region for
            assistive tech without also claiming the ARIA "status" role —
            role="status" would collide with the page's own success/error
            banner (also role="status"/role="alert") under getByRole("status")
            queries, which surfaced as a real ambiguity on the Acquisition
            Source create form: its success redirect lands back on the same
            route that renders this very guard again, so both elements would
            coexist in the DOM at once. */}
        <span
          className={
            statusText ? "admin-form-status admin-form-status-active" : "admin-form-status"
          }
          aria-live="polite"
        >
          {statusText}
        </span>
      </div>

      <ConfirmDialog
        open={pendingNav !== null}
        title="Discard unsaved changes?"
        description="You have changes that haven’t been saved. Leaving this page will discard them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        confirmTone="danger"
        onConfirm={confirmDiscardNavigation}
        onCancel={closePendingNav}
      />

      <ConfirmDialog
        open={recovery !== null}
        title="Restore unsaved draft?"
        description={
          recovery?.stale
            ? "Unsaved changes from this tab were found for this record. Note: the saved record has changed since this draft, so restoring may overwrite newer data."
            : "Unsaved changes from this tab were found for this record."
        }
        confirmLabel="Restore draft"
        cancelLabel="Discard draft"
        confirmTone="primary"
        // Favor restoring the user's work: Restore is the primary,
        // initially-focused action. Discard draft is an explicit secondary
        // choice, never the safe default — and dismissing (Escape/backdrop)
        // preserves the draft rather than discarding it.
        initialFocus="confirm"
        onConfirm={restoreDraft}
        onCancel={discardDraft}
        onDismiss={dismissRecovery}
      />
    </>
  );
}
