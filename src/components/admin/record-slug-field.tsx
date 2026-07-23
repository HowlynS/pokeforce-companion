"use client";

// Live Page-address (slug) field for an admin create/edit form (Phase B1,
// System B; edit-mode synchronization revised in the Admin Visual/UX
// Correction pass, Part 11): auto-generates from the current Name while in
// "auto" mode, switching to "manual" mode the instant the contributor
// edits the field themselves (typing OR pasting — both fire the same
// onChange). Manual override is final for the rest of that form session —
// the earlier visible "Use name" reset control was removed in a later
// UI-cleanup pass (no way remains to flip back to auto mode without
// reloading the page), so `isManual` can now only ever transition
// false→true. Combines two things RecordNameField already does well
// (controlled input + debounced/sequence-guarded availability checking)
// with the one thing this field alone needs: reconciling its own value
// against a live sibling field's value.
//
// BOTH create and edit now start in auto mode (edit used to start
// permanently manual, protecting the persisted slug by never touching it
// again — the user-approved behavior now is that a Name edit CAN propose
// a new URL, exactly like create already did, right up until the
// contributor manually edits Page address themselves). What differs
// between the two modes is only the auto-generated VALUE while still
// auto: `initialNameRef` captures whichever `nameValue` this field first
// rendered with (blank on create, the record's persisted name on edit).
// While `nameValue` still equals that captured value, the auto value is
// `initialSlug` — the persisted slug (or "" on create, where there is
// none) — so an edit form's Page address stays exactly what is currently
// saved until Name genuinely changes. The MOMENT `nameValue` differs from
// that first-rendered value, the auto value switches to
// `normalizeSlug(nameValue)`, live, on every further keystroke — deleting
// a word, replacing a word, or clearing Name down to blank (which
// normalizes to "") all update Page address immediately, matching create
// mode's existing behavior exactly. This is a pure per-render derivation,
// never a state update pushed from an effect, so it can never lag a
// keystroke by a render.
//
// The displayed feedback state is DERIVED during render, mirroring
// RecordNameField's own shape (idle/checking/available/taken/current/
// failed) plus one new state this field alone needs: "invalid" — the
// candidate normalizes to nothing (e.g. "!!!"), which is neither blank
// (idle) nor a real availability question, so it gets the SAME wording
// the server's own invalid_slug error already uses, never a false claim
// of availability. Only the latest async answer is stored in state,
// exactly like RecordNameField.

import { useEffect, useRef, useState } from "react";
import { designTokens } from "@/lib/design-tokens";
import { normalizeSlug } from "@/lib/slug";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import {
  SLUG_RESTORE_EVENT,
  type SlugRestoreDetail,
} from "@/lib/admin/slug-restore-event";
import type { RecordSlugAvailability } from "@/lib/admin/record-slug";

const DEBOUNCE_MS = 300;
// Verbatim the same wording every resource's own server-side invalid_slug
// error already uses (src/app/admin/*/new/page.tsx, */[slug]/edit/page.tsx)
// — the live preview and the eventual server error can never disagree.
const INVALID_SLUG_TEXT =
  "Enter a valid slug using lowercase letters, numbers, and hyphens.";

type FeedbackState =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken"
  | "current"
  | "failed";

// The async answer for one specific normalized candidate. Displayed only
// while the field still normalizes to that exact candidate.
type CheckResult = {
  candidate: string;
  state: "available" | "taken" | "failed";
};

const FEEDBACK_COLOR: Record<FeedbackState, string> = {
  idle: designTokens.colors.textMuted,
  invalid: designTokens.colors.danger,
  checking: designTokens.colors.textMuted,
  available: designTokens.colors.success,
  taken: designTokens.colors.danger,
  current: designTokens.colors.textMuted,
  failed: designTokens.colors.textMuted,
};

type RecordSlugFieldProps = {
  /** The live Name value from a sibling field (RecordNameField's own
      onNameChange) — both create and edit start in auto-generation mode
      and track this live until the contributor manually edits Page
      address themselves (Part 11: edit no longer starts permanently
      manual). */
  nameValue: string;
  /** Edit-only: the record's persisted Page address — the auto value
      shown until Name actually changes from its own first-rendered
      value. */
  initialSlug?: string;
  /** Edit-only: the record's own id, excluded server-side so it cannot
      conflict with itself. */
  excludeId?: string;
  checkAvailabilityAction: (
    rawSlug: string,
    rawExcludeId?: string
  ) => Promise<RecordSlugAvailability>;
  /** The resource's exact server-side duplicate message, reused verbatim
      so the live feedback and the submission error never disagree. */
  takenText: string;
  /** Unique id for this field's live region, e.g. "item-slug-availability". */
  regionId: string;
};

export function RecordSlugField({
  nameValue,
  initialSlug,
  excludeId,
  checkAvailabilityAction,
  takenText,
  regionId,
}: RecordSlugFieldProps) {
  // Only the contributor's own manual edits are stored — auto-generation
  // is a pure derivation of the live Name value (below), computed during
  // render rather than pushed into state from an effect, so there is no
  // extra render cycle and no risk of the effect and a keystroke racing.
  const [manualSlug, setManualSlug] = useState(initialSlug ?? "");
  // Part 11: BOTH create and edit start in auto mode now — nothing ever
  // sets isManual back to false again once the contributor edits Page
  // address themselves (no "Use name" reset control exists), matching
  // create's own long-standing one-way behavior.
  const [isManual, setIsManual] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const requestSequence = useRef(0);
  // Captures whichever `nameValue` this field first rendered with — ""
  // on create (Name starts blank), the record's persisted name on edit —
  // exactly ONCE, on mount, never updated again. A lazy useState
  // initializer (not useRef): reading a ref's `.current` DURING render is
  // a lint-flagged anti-pattern (react-hooks/refs) even though it would
  // have worked here; state read during render is the correct tool for
  // "a value computed once at mount and never changed again." This is
  // what lets edit mode start showing the PERSISTED slug (not a value
  // re-derived from Name) while still tracking Name live from the moment
  // it actually changes.
  const [initialNameValue] = useState(nameValue);

  // Whether there is a persisted slug to start from at all is the real
  // discriminator (not an arbitrary create/edit flag): create passes no
  // `initialSlug`, so its auto value is simply the live generated slug,
  // always — identical to this field's original create-only behavior,
  // and correct regardless of what nameValue happens to be on any given
  // render. When a persisted `initialSlug` DOES exist (edit), the auto
  // value stays that persisted value for as long as Name has not yet
  // diverged from the value this field first rendered with — an edit
  // form's Page address stays exactly what is currently saved until Name
  // genuinely changes. The moment Name differs from that first-rendered
  // value, the auto value switches to the live generated slug and keeps
  // tracking every further keystroke — deleting a word, replacing a
  // word, or clearing Name to blank all update Page address immediately,
  // matching create mode's own always-live behavior from that point on.
  const autoSlug =
    initialSlug !== undefined && nameValue === initialNameValue
      ? initialSlug
      : normalizeSlug(nameValue);
  const slug = !isManual ? autoSlug : manualSlug;

  // The rendered <input>, so a PROGRAMMATIC slug change (auto-sync from
  // Name, which React writes to the controlled value with no native input
  // event) can emit the shared form-change signal for the AdminFormGuard's
  // dirty detection — deterministically, instead of relying on a timed
  // recompute. See src/lib/admin/form-change-event.ts.
  const inputRef = useRef<HTMLInputElement>(null);
  const slugMountedRef = useRef(false);

  const candidate = normalizeSlug(slug);
  const isBlankField = slug.trim() === "";
  const isInvalidCandidate = !isBlankField && candidate === "";
  const isCurrentSlug =
    initialSlug !== undefined && candidate === normalizeSlug(initialSlug);

  const state: FeedbackState = isBlankField
    ? "idle"
    : isInvalidCandidate
      ? "invalid"
      : isCurrentSlug
        ? "current"
        : result !== null && result.candidate === candidate
          ? result.state
          : "checking";

  const feedbackText: Record<FeedbackState, string> = {
    idle: "",
    invalid: INVALID_SLUG_TEXT,
    checking: "Checking page address availability…",
    available: "Page address is available.",
    taken: takenText,
    current: "",
    failed: "Could not check the page address right now. You can still submit.",
  };

  useEffect(() => {
    // Nothing to ask the server: blank, structurally invalid (never
    // sent — B5), or the unchanged current slug. Advancing the sequence
    // still invalidates any in-flight check so its stale answer is
    // dropped.
    if (isBlankField || isInvalidCandidate || isCurrentSlug) {
      requestSequence.current += 1;
      return;
    }

    if (result !== null && result.candidate === candidate) {
      return;
    }

    const sequence = ++requestSequence.current;

    const timer = setTimeout(() => {
      checkAvailabilityAction(candidate, excludeId)
        .then((availability) => {
          if (requestSequence.current !== sequence) {
            return; // Newer input exists; drop this stale answer.
          }
          setResult({
            candidate,
            state: availability === "unchecked" ? "failed" : availability,
          });
        })
        .catch(() => {
          if (requestSequence.current !== sequence) {
            return;
          }
          setResult({ candidate, state: "failed" });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    candidate,
    isBlankField,
    isInvalidCandidate,
    isCurrentSlug,
    excludeId,
    result,
    checkAvailabilityAction,
  ]);

  // Emit the shared form-change signal whenever the COMMITTED slug value
  // changes (skipping the initial mount, whose value already matches the
  // guard's baseline). This fires for auto-sync from Name — the change that
  // carries no native input event — and harmlessly (idempotently) for
  // manual typing too, which already emits its own input event.
  useEffect(() => {
    if (!slugMountedRef.current) {
      slugMountedRef.current = true;
      return;
    }
    dispatchFormChange(inputRef.current);
  }, [slug]);

  // Sonnet Rollout Pass, Part 3 correction: AdminFormGuard's draft
  // restoration applies this exact value + sync mode directly to state via
  // a dedicated custom event, bypassing handleChange entirely — restoring
  // a draft is not a manual edit, and must not be treated like one. See
  // src/lib/admin/slug-restore-event.ts.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const onRestore = (event: Event) => {
      const detail = (event as CustomEvent<SlugRestoreDetail>).detail;
      if (!detail) {
        return;
      }
      setManualSlug(detail.value);
      setIsManual(detail.manual);
    };
    input.addEventListener(SLUG_RESTORE_EVENT, onRestore);
    return () => input.removeEventListener(SLUG_RESTORE_EVENT, onRestore);
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Any direct edit — typed or pasted, this handler fires identically
    // either way — switches to manual mode immediately: further Name
    // changes must not overwrite what the contributor just typed.
    setIsManual(true);
    setManualSlug(event.target.value);
  }

  return (
    <div className="form-field">
      <label className="form-field">
        <span className="form-field-label">Page address</span>
        <input
          ref={inputRef}
          type="text"
          name="slug"
          value={slug}
          onChange={handleChange}
          onPaste={() => setIsManual(true)}
          aria-describedby={regionId}
          // A plain data-attribute, never a named form field: it must NOT be
          // part of FormData (it would otherwise become part of
          // AdminFormGuard's meaningful-change comparison, which would
          // wrongly report the form dirty after entering manual mode and
          // then retyping back to the original value — the sync mode
          // itself is restoration metadata, not editable record data). See
          // slug-restore-event.ts and AdminFormGuard's writeDraftNow, which
          // read this attribute directly off the DOM.
          data-slug-sync-mode={isManual ? "manual" : "auto"}
          className="form-input"
        />
      </label>

      <p
        id={regionId}
        aria-live="polite"
        className="form-field-feedback"
        style={{ color: FEEDBACK_COLOR[state] }}
      >
        {feedbackText[state]}
      </p>
    </div>
  );
}
