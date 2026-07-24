"use client";

// Shared accessible admin dropdown (Massive Admin Interaction Completion
// Pass, Phase 1). Replaces a native <select> with a dark/gold "listbox
// button" (WAI-ARIA APG "select-only" combobox pattern) while submitting
// EXACTLY like the native control it replaces: a real named form field
// whose value participates in ordinary HTML form submission, native
// constraint validation, AdminFormGuard's dirty-state snapshot, session
// drafts, and draft restoration — no client-side polling, no parallel
// state system.
//
// Architecture:
//   - Focus never leaves the trigger <button>. The open listbox is
//     announced/highlighted via aria-activedescendant on the button,
//     matching the APG "Select Only" combobox pattern exactly — this
//     avoids all the extra focus-trap/restoration complexity a
//     focus-moves-into-the-listbox design would need.
//   - The submitted value lives in a single proxy <input>, kept in the tab
//     order via tabIndex={-1} and hidden via the same visually-hidden clip
//     technique image-panel's own remove checkbox already uses (never
//     display:none/disabled/readonly, all of which the browser excludes
//     from constraint validation — a readonly or hidden-type field would
//     silently make `required` a no-op, breaking AdminFormGuard's Ctrl+S
//     handler, which gates on the real form.checkValidity()).
//   - A user-driven selection (click or keyboard) updates this component's
//     own value AND dispatches the shared FORM_CHANGE_EVENT on the proxy
//     input — the exact same signal RecordSlugField's auto-sync already
//     established for "a value changed with no native input event" (see
//     form-change-event.ts). AdminFormGuard's restoreDraft(), conversely,
//     restores this field through the ordinary setNativeValue() path
//     (native input/change dispatch) like any other plain field — which
//     this component picks up via a normal onChange, syncing its own
//     displayed selection back from the restored value. Both directions
//     reuse existing shared infrastructure; nothing new was invented.
//
// Supports both controlled (`value`/`onValueChange`) and uncontrolled
// (`defaultValue`) usage, mirroring RecordSlugField/DateField's own
// established dual-mode shape in this codebase.
//
// The open listbox renders through a portal to the #admin-select-portal-root
// div AdminShell renders (a plain descendant of .admin-shell, right beside
// .admin-frame) rather than as a plain DOM sibling of the trigger, and
// deliberately NOT to document.body directly: the admin dark-mode color
// tokens (--color-surface-raised, --color-border, --color-text, etc.) are
// declared scoped to .admin-shell itself, not :root, so a panel appended
// straight under <body> would inherit none of them and render with a fully
// transparent background — the page content behind it visibly bleeding
// through the "opaque" option list. Falling back to document.body when the
// portal root isn't present (e.g. a component test with no AdminShell
// around it) keeps this safe to render in isolation. This is not a styling
// choice —
// every call site wraps AdminSelect in a plain <label> exactly like the
// native <select> it replaces (e.g. <label><span>Category</span>
// <AdminSelect .../></label>), and the browser's accessible-name-from-label
// algorithm concatenates the ENTIRE label subtree's text. With the listbox
// rendered as a normal descendant, opening it would inject every option's
// text into the trigger's own computed name (e.g. "Category No category
// Components Consumables…"), which silently broke every existing test's
// getByRole("combobox", { name: "Category" }) query the instant the panel
// opened. Portaling the open listbox out from under the label keeps the
// trigger's accessible name exactly "Category" (or whatever the label
// says) in every state, open or closed — a real correctness fix, not
// cosmetic. Position is computed from the trigger's own
// getBoundingClientRect() on open (position: fixed, so no scroll-offset
// math is needed) and reused for the existing above/below flip logic.

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import { ResourceIcon } from "@/components/admin/resource-icon";

export type AdminSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional resolved image URL for image-enabled entity options (Item,
      Recipe, Profession, Category, Location, and future entities like
      Currency/Shop/NPC) — rendered as a compact ResourceIcon beside the
      label in both the trigger and the option row. Deliberately generic
      (a plain string | null, never a Prisma type): callers resolve the
      URL themselves from whatever query already loaded it.
      Enum/metadata/technical options (Location Type, Game Version,
      verification state, ...) simply omit this field entirely, so no
      icon column renders and no layout changes for them. Entity options
      that DO use icons should still pass `imageUrl: null` for a record
      with no image (never omit it), so every option in that list keeps
      the same reserved icon slot and stays aligned. */
  imageUrl?: string | null;
};

export type AdminSelectProps = {
  /** The field name submitted with the form — identical contract to the
      native <select> this replaces. */
  name: string;
  options: readonly AdminSelectOption[];
  /** Controlled selected value. Omit for uncontrolled usage. */
  value?: string;
  /** Uncontrolled starting value (mirrors a native <select defaultValue>). */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shown when the resolved value is "" and matches no option. */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Associates the proxy field with a <form> element elsewhere in the
      document (standard HTML `form` attribute) — needed when this control
      renders inside a contextual aside panel outside the resource's own
      <form>, exactly like RecordSlugField/GameVersionVerificationControls. */
  formId?: string;
  id?: string;
  className?: string;
};

const TYPEAHEAD_RESET_MS = 500;

// See the module comment above: portaling under the admin-scoped color
// tokens' actual ancestor, not document.body, is what keeps the panel's
// background genuinely opaque.
function getPortalContainer(): Element | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById("admin-select-portal-root") ?? document.body;
}

function firstEnabledIndex(options: readonly AdminSelectOption[]): number {
  return options.findIndex((option) => !option.disabled);
}

function lastEnabledIndex(options: readonly AdminSelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i -= 1) {
    if (!options[i].disabled) {
      return i;
    }
  }
  return -1;
}

function nextEnabledIndex(
  options: readonly AdminSelectOption[],
  from: number
): number {
  for (let i = from + 1; i < options.length; i += 1) {
    if (!options[i].disabled) {
      return i;
    }
  }
  return from;
}

function prevEnabledIndex(
  options: readonly AdminSelectOption[],
  from: number
): number {
  for (let i = from - 1; i >= 0; i -= 1) {
    if (!options[i].disabled) {
      return i;
    }
  }
  return from;
}

export function AdminSelect({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  required = false,
  disabled = false,
  formId,
  id,
  className,
}: AdminSelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelPosition, setPanelPosition] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const proxyRef = useRef<HTMLInputElement>(null);
  // The portaled panel lives outside rootRef in the DOM (see the module
  // comment on why it's portaled at all) — outside-click detection below
  // must treat it as "inside" too, or a click on the panel itself (an
  // option) is wrongly seen as an outside click and closes the dropdown
  // out from under its own click/commit.
  const panelRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const mountedRef = useRef(false);

  const typeaheadBufferRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = options.findIndex((option) => option.value === currentValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function commit(newValue: string) {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  }

  // Deterministic signal for AdminFormGuard's dirty comparison — see the
  // module comment. Skips the initial mount, whose value already matches
  // whatever baseline snapshot the guard captures.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    dispatchFormChange(proxyRef.current);
  }, [currentValue]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  // Computes the portaled panel's fixed-position coordinates from the
  // trigger's own rect, flipping above the trigger when there is
  // genuinely more room there than below (a plain viewport check, not a
  // full popover-anchoring library — good enough to keep options from
  // being clipped by the viewport's bottom edge near the page's end).
  function updatePanelPosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const direction = spaceBelow < 240 && spaceAbove > spaceBelow ? "up" : "down";
    setPanelPosition(
      direction === "up"
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4 }
        : { left: rect.left, width: rect.width, top: rect.bottom + 4 }
    );
  }

  // Stale panelPosition after close is harmless — the portal below is
  // already gated on `open` alone, so there is nothing to reset here (and
  // resetting synchronously in the effect body would itself be a needless
  // cascading render).
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePanelPosition();
    // A fixed-position panel anchored by a one-time rect measurement would
    // visually detach from the trigger if the page scrolls or resizes
    // while open — reposition (never close) keeps it correctly anchored.
    // Capture-phase so this also catches scrolling inside a nested
    // scrollable ancestor, not just the window itself; deliberately NOT
    // scoped away from the panel's own internal scroll, since repositioning
    // (unlike closing) is harmless even when triggered by scrolling the
    // option list itself — it simply recomputes the same coordinates.
    window.addEventListener("scroll", updatePanelPosition, true);
    window.addEventListener("resize", updatePanelPosition);
    return () => {
      window.removeEventListener("scroll", updatePanelPosition, true);
      window.removeEventListener("resize", updatePanelPosition);
    };
  }, [open]);

  function clearTypeahead() {
    typeaheadBufferRef.current = "";
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = null;
    }
  }

  function handleTypeahead(char: string) {
    const isRepeatSingleChar =
      typeaheadBufferRef.current.length > 0 &&
      typeaheadBufferRef.current
        .split("")
        .every((existing) => existing.toLowerCase() === char.toLowerCase());
    typeaheadBufferRef.current = isRepeatSingleChar
      ? typeaheadBufferRef.current + char
      : char;

    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
    }
    typeaheadTimerRef.current = setTimeout(clearTypeahead, TYPEAHEAD_RESET_MS);

    const buffer = typeaheadBufferRef.current.toLowerCase();
    const searchPrefix = isRepeatSingleChar ? char.toLowerCase() : buffer;
    const startFrom = activeIndex >= 0 ? activeIndex : selectedIndex >= 0 ? selectedIndex : -1;

    // Search once around the full list, starting just after the current
    // position, so repeated presses of the same letter cycle forward
    // through every match instead of always landing on the first one.
    for (let step = 1; step <= options.length; step += 1) {
      const index = (startFrom + step) % options.length;
      const option = options[index];
      if (!option.disabled && option.label.toLowerCase().startsWith(searchPrefix)) {
        setActiveIndex(index);
        if (!open) {
          commit(option.value);
        }
        return;
      }
    }
  }

  function openAt(index: number) {
    setOpen(true);
    setActiveIndex(index);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : lastEnabledIndex(options));
        return;
      }
      if (printable) {
        event.preventDefault();
        handleTypeahead(event.key);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((current) => nextEnabledIndex(options, current));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((current) => prevEnabledIndex(options, current));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(firstEnabledIndex(options));
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(lastEnabledIndex(options));
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (activeIndex >= 0 && !options[activeIndex].disabled) {
          commit(options[activeIndex].value);
        }
        setOpen(false);
        return;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        return;
      case "Tab":
        setOpen(false);
        return;
      default:
        if (printable) {
          event.preventDefault();
          handleTypeahead(event.key);
        }
    }
  }

  const activeId =
    open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const portalContainer = open && panelPosition ? getPortalContainer() : null;

  return (
    <div ref={rootRef} className="admin-select">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={
          className ? `admin-select-trigger ${className}` : "admin-select-trigger"
        }
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeId}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openAt(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="admin-select-value-group">
          {selectedOption && selectedOption.imageUrl !== undefined ? (
            <ResourceIcon imageUrl={selectedOption.imageUrl} size="sm" />
          ) : null}
          <span
            className={
              selectedOption ? "admin-select-value" : "admin-select-placeholder"
            }
          >
            {selectedOption ? selectedOption.label : (placeholder ?? "")}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className="admin-select-chevron" />
      </button>

      {portalContainer && panelPosition
        ? createPortal(
            <ul
              ref={panelRef}
              role="listbox"
              id={listboxId}
              className="admin-select-panel"
              style={{
                position: "fixed",
                left: panelPosition.left,
                width: panelPosition.width,
                top: panelPosition.top,
                bottom: panelPosition.bottom,
              }}
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={option.value === currentValue}
                  aria-disabled={option.disabled}
                  className={
                    "admin-select-option" +
                    (index === activeIndex ? " admin-select-option--active" : "") +
                    (option.value === currentValue ? " admin-select-option--selected" : "") +
                    (option.disabled ? " admin-select-option--disabled" : "")
                  }
                  onMouseEnter={() => {
                    if (!option.disabled) {
                      setActiveIndex(index);
                    }
                  }}
                  onClick={() => {
                    if (option.disabled) {
                      return;
                    }
                    commit(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  {option.imageUrl !== undefined ? (
                    <ResourceIcon imageUrl={option.imageUrl} size="sm" />
                  ) : null}
                  <span className="admin-select-option-label">
                    {option.label}
                  </span>
                </li>
              ))}
            </ul>,
            portalContainer
          )
        : null}

      {/* The real submitted field. Never type="hidden" or readonly/disabled
          — both are excluded from HTML constraint validation, which would
          silently turn `required` into a no-op and defeat AdminFormGuard's
          Ctrl+S handler (form.checkValidity()). tabIndex={-1} plus the
          visually-hidden clip technique (never display:none, which is ALSO
          excluded from constraint validation) keeps it out of the tab
          order and off-screen without ever being a second focusable
          control for this one field — the trigger button above is the
          only element a keyboard or screen-reader user ever reaches. */}
      <input
        ref={proxyRef}
        type="text"
        name={name}
        value={currentValue}
        required={required}
        aria-hidden="true"
        tabIndex={-1}
        className="admin-select-proxy"
        form={formId}
        onChange={(event) => {
          if (!isControlled) {
            setInternalValue(event.target.value);
          }
          onValueChange?.(event.target.value);
        }}
      />
    </div>
  );
}
