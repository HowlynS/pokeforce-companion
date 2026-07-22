"use client";

// Live Page-address (slug) field for an admin create/edit form (Phase B1,
// System B): auto-generates from the current Name while in "auto" mode,
// switching to "manual" mode the instant the contributor edits the field
// themselves (typing OR pasting — both fire the same onChange). Manual
// override is final for the rest of that form session — the earlier
// visible "Use name" reset control was removed in a later UI-cleanup
// pass (no way remains to flip back to auto mode without reloading the
// page), so `isManual` can now only ever transition false→true. Combines
// two things RecordNameField already does well (controlled input +
// debounced/sequence-guarded availability checking) with the one thing
// this field alone needs: reconciling its own value against a live
// sibling field's value.
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
  /** "create": starts in auto-generation mode, following the live Name
      value, until manually edited. "edit": starts manually controlled
      from the start (protects the existing persisted URL) — Name
      changes never touch it automatically, even if the persisted slug
      happens to resemble the current Name. */
  mode: "create" | "edit";
  /** The live Name value from a sibling field (RecordNameField's own
      onNameChange), used only while in auto-generation mode. */
  nameValue: string;
  /** Edit-only: the record's persisted Page address. */
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
  mode,
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
  // Edit starts manually controlled from the start (B4) — there is no
  // "resembles the current Name" heuristic that would silently re-enable
  // auto-generation on a persisted record.
  const [isManual, setIsManual] = useState(mode === "edit");
  const [result, setResult] = useState<CheckResult | null>(null);
  const requestSequence = useRef(0);

  // While still auto (`mode` decides the STARTING value of `isManual` —
  // create starts auto, edit starts manual, per B2/B4, and nothing ever
  // sets it back to false again now that the reset control is gone), the
  // field's value simply IS the live Name's own generated slug —
  // recomputed every render, never stored separately, so it can never
  // drift from `nameValue`.
  const slug = !isManual ? normalizeSlug(nameValue) : manualSlug;

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
          type="text"
          name="slug"
          value={slug}
          onChange={handleChange}
          onPaste={() => setIsManual(true)}
          aria-describedby={regionId}
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
