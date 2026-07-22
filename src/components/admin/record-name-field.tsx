"use client";

// Live duplicate-name feedback for an admin create/edit form, generalized
// from the proven Item implementation: one controlled input plus a polite
// live region, parameterized by the resource's availability server action,
// its exact duplicate wording, and its live-region id. The input still
// renders (with its initial value) before hydration and submits as a plain
// form field, so every form keeps working without JavaScript — each
// resource's own server action remains the authoritative duplicate check.
//
// The displayed state is DERIVED during render (blank → idle, unchanged
// current name → current, answered name → its answer, otherwise checking);
// the only stored state is the latest async answer, written exclusively
// from the request callback. Requests are debounced (300 ms) and guarded by
// a sequence counter so a slow, stale response can never overwrite the
// state for newer input. A failed request degrades to a notice that never
// blocks submission, and the submit button is never disabled by this
// component.

import { useEffect, useRef, useState } from "react";
import { designTokens } from "@/lib/design-tokens";
import {
  recordNamesAreEquivalent,
  normalizeRecordNameInput,
  type RecordNameAvailability,
} from "@/lib/admin/record-name";

const DEBOUNCE_MS = 300;

type FeedbackState =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "current"
  | "failed";

// The async answer for one specific (trimmed) name. Displayed only while
// the input still holds that exact name.
type CheckResult = {
  name: string;
  state: "available" | "taken" | "failed";
};

const FEEDBACK_COLOR: Record<FeedbackState, string> = {
  idle: designTokens.colors.textMuted,
  checking: designTokens.colors.textMuted,
  available: designTokens.colors.success,
  taken: designTokens.colors.danger,
  current: designTokens.colors.textMuted,
  failed: designTokens.colors.textMuted,
};

type RecordNameFieldProps = {
  // The resource's protected availability server action (the "Action"
  // suffix marks it as a Server Action crossing the client boundary).
  checkAvailabilityAction: (
    rawName: string,
    rawExcludeId?: string
  ) => Promise<RecordNameAvailability>;
  // The resource's exact server-side duplicate message, reused verbatim so
  // the live feedback and the submission error never disagree.
  takenText: string;
  // Unique id for this form's live region (also the aria-describedby
  // target), e.g. "category-name-availability".
  regionId: string;
  // Edit-only: the record's saved name (treated as "current", never
  // queried) and its id (excluded server-side so the record cannot
  // conflict with itself).
  originalName?: string;
  excludeId?: string;
  /** Phase B1, System B: lets a parent coordinator (RecordIdentityFields)
      observe the live Name value for Page-address auto-generation,
      without duplicating this field's own state/debounce logic. Called
      with every keystroke, alongside this component's own internal
      state update — optional so every other existing caller (plain
      Name-only forms) is unaffected. */
  onNameChange?: (name: string) => void;
};

export function RecordNameField({
  checkAvailabilityAction,
  takenText,
  regionId,
  originalName,
  excludeId,
  onNameChange,
}: RecordNameFieldProps) {
  const [name, setName] = useState(originalName ?? "");
  const [result, setResult] = useState<CheckResult | null>(null);
  // Monotonic request counter: only the newest request may apply its result.
  const requestSequence = useRef(0);

  const trimmed = normalizeRecordNameInput(name);
  const isCurrentName =
    originalName !== undefined && recordNamesAreEquivalent(name, originalName);

  // Derived, never stored: what the live region shows right now.
  const state: FeedbackState =
    trimmed === ""
      ? "idle"
      : isCurrentName
        ? "current"
        : result !== null && result.name === trimmed
          ? result.state
          : "checking";

  // Every message doubles as the non-color cue: the words alone say what
  // the state means. Visual Pass II Section 4: a VALID name (available or
  // unchanged/current) is now deliberately silent — the redundant "this is
  // fine" text was removed, so the feedback row only ever speaks up when
  // there is something the admin actually needs to know (checking,
  // taken, or a failed check).
  const feedbackText: Record<FeedbackState, string> = {
    idle: "",
    checking: "Checking name availability...",
    available: "",
    taken: takenText,
    current: "",
    failed: "Could not check the name right now. You can still submit.",
  };

  useEffect(() => {
    // Nothing to ask the server: a blank name or the unchanged current
    // name. Advancing the sequence still invalidates any in-flight check so
    // its stale answer is dropped.
    if (trimmed === "" || isCurrentName) {
      requestSequence.current += 1;
      return;
    }

    // The displayed result already answers exactly this name.
    if (result !== null && result.name === trimmed) {
      return;
    }

    const sequence = ++requestSequence.current;

    const timer = setTimeout(() => {
      checkAvailabilityAction(trimmed, excludeId)
        .then((availability) => {
          if (requestSequence.current !== sequence) {
            return; // Newer input exists; drop this stale answer.
          }
          // "unchecked" (blank/overlong on the server side) degrades to the
          // non-blocking failure notice.
          setResult({
            name: trimmed,
            state: availability === "unchecked" ? "failed" : availability,
          });
        })
        .catch(() => {
          if (requestSequence.current !== sequence) {
            return;
          }
          setResult({ name: trimmed, state: "failed" });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, isCurrentName, excludeId, result, checkAvailabilityAction]);

  return (
    <div className="form-field">
      <label className="form-field">
        <span className="form-field-label">Name</span>
        <input
          type="text"
          name="name"
          required
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            onNameChange?.(event.target.value);
          }}
          aria-describedby={regionId}
          className="form-input"
        />
      </label>
      {/* Always-present polite live region, kept OUTSIDE the label so the
          input's accessible name stays exactly "Name" — the feedback is a
          description (aria-describedby), not part of the label. Deliberately
          not role="status": that role belongs to the pages' success
          messages. The shared .form-field-feedback class (Visual Pass II
          Section 5) is what keeps this row's reserved height and
          horizontal inset identical to the Page address field's own
          reserved spacer row beneath it — only the dynamic color stays
          inline. */}
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
