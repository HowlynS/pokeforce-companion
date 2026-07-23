// Dedicated draft-restoration signal for RecordSlugField (Sonnet Rollout
// Pass, Part 3 correction). AdminFormGuard's generic restoreDraft() applies
// most fields by writing the DOM value and dispatching native input/change
// events (see setNativeValue in admin-form-guard.tsx) — safe for ordinary
// controlled inputs, whose onChange handlers only ever react to a new
// value. RecordSlugField is different: its onChange handler (handleChange)
// treats ANY change event as a deliberate manual edit and permanently
// disables Name -> Page-address auto-sync. Restoring a draft is not a
// manual edit — it must reproduce whichever sync mode (auto or manual) was
// in effect when the draft was written, not unconditionally force manual
// mode.
//
// So the "slug" field is restored through this dedicated custom event
// instead of the generic native-event path: it carries both the value AND
// the sync mode explicitly, and RecordSlugField applies both directly to
// its own state (bypassing handleChange entirely), so a restore can put the
// field back into auto mode with live Name-tracking intact, or back into
// manual mode with the override preserved — deterministically, never
// inferred from the value alone.
//
// The sync mode itself is NEVER captured as a named form field (it would
// then become part of AdminFormGuard's meaningful-change/dirty comparison,
// wrongly marking the form dirty after a manual edit is retyped back to
// its original value — the existing, approved behavior is that this
// returns to clean). Instead RecordSlugField exposes it only as a
// `data-slug-sync-mode` attribute on its own <input> (invisible to
// FormData), and AdminFormGuard reads that attribute directly off the DOM
// when writing a draft, storing it as separate top-level metadata on the
// AdminDraft record (see form-draft.ts) rather than inside its restorable
// `values`.

export const SLUG_RESTORE_EVENT = "pf:slug-restore";

// The draft metadata key (AdminDraft.slugSyncMode) and DOM dataset key
// (`element.dataset.slugSyncMode`, i.e. the `data-slug-sync-mode`
// attribute) — shared here so AdminFormGuard and RecordSlugField never
// duplicate the literal.
export const SLUG_SYNC_MODE_KEY = "slugSyncMode";

export type SlugRestoreDetail = {
  value: string;
  manual: boolean;
};

/** Dispatches the slug restoration signal from `element` (its own <input>),
    bubbling so RecordSlugField's document-level listener (filtered to its
    own owning form) receives it. A no-op when the element is unavailable. */
export function dispatchSlugRestore(
  element: Element | null | undefined,
  detail: SlugRestoreDetail
): void {
  if (!element) {
    return;
  }
  try {
    element.dispatchEvent(
      new CustomEvent<SlugRestoreDetail>(SLUG_RESTORE_EVENT, {
        bubbles: true,
        detail,
      })
    );
  } catch {
    // CustomEvent unavailable (non-DOM environment) — nothing to signal.
  }
}
