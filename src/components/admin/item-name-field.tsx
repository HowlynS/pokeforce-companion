"use client";

// Live duplicate-name feedback for the Item create/edit forms. This is the
// project's first client component, kept deliberately small: one controlled
// input plus a polite live region. The input still renders (with its
// initial value) before hydration and submits as a plain form field, so the
// form keeps working without JavaScript — the server action's own duplicate
// check remains the authoritative protection either way.
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
import { checkItemNameAvailability } from "@/app/admin/items/name-availability";
import { designTokens } from "@/lib/design-tokens";
import {
  itemNamesAreEquivalent,
  normalizeItemNameInput,
} from "@/lib/items/item-name";

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

// Every message doubles as the non-color cue: the words alone say what the
// state means. "taken" reuses the server actions' exact wording so the live
// feedback and the submission error never disagree.
const FEEDBACK_TEXT: Record<FeedbackState, string> = {
  idle: "",
  checking: "Checking name availability...",
  available: "This name is available.",
  taken: "An item with that name already exists.",
  current: "This is the current name.",
  failed: "Could not check the name right now. You can still submit.",
};

const FEEDBACK_COLOR: Record<FeedbackState, string> = {
  idle: designTokens.colors.textMuted,
  checking: designTokens.colors.textMuted,
  available: designTokens.colors.success,
  taken: designTokens.colors.danger,
  current: designTokens.colors.textMuted,
  failed: designTokens.colors.textMuted,
};

type ItemNameFieldProps = {
  inputStyle: React.CSSProperties;
  // Edit-only: the record's saved name (treated as "current", never queried)
  // and its id (excluded server-side so the record cannot conflict with
  // itself).
  originalName?: string;
  excludeId?: string;
};

export function ItemNameField({
  inputStyle,
  originalName,
  excludeId,
}: ItemNameFieldProps) {
  const [name, setName] = useState(originalName ?? "");
  const [result, setResult] = useState<CheckResult | null>(null);
  // Monotonic request counter: only the newest request may apply its result.
  const requestSequence = useRef(0);

  const trimmed = normalizeItemNameInput(name);
  const isCurrentName =
    originalName !== undefined && itemNamesAreEquivalent(name, originalName);

  // Derived, never stored: what the live region shows right now.
  const state: FeedbackState =
    trimmed === ""
      ? "idle"
      : isCurrentName
        ? "current"
        : result !== null && result.name === trimmed
          ? result.state
          : "checking";

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
      checkItemNameAvailability(trimmed, excludeId)
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
  }, [trimmed, isCurrentName, excludeId, result]);

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <label style={{ display: "grid", gap: "6px" }}>
        <span style={{ color: designTokens.colors.textMuted }}>Name</span>
        <input
          type="text"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby="item-name-availability"
          style={inputStyle}
        />
      </label>
      {/* Always-present polite live region, kept OUTSIDE the label so the
          input's accessible name stays exactly "Name" — the feedback is a
          description (aria-describedby), not part of the label. Deliberately
          not role="status": that role belongs to the pages' success
          messages. */}
      <p
        id="item-name-availability"
        aria-live="polite"
        style={{
          margin: 0,
          minHeight: "1.2em",
          fontSize: "14px",
          color: FEEDBACK_COLOR[state],
        }}
      >
        {FEEDBACK_TEXT[state]}
      </p>
    </div>
  );
}
