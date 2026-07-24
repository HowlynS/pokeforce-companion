"use client";

// Searchable variant of AdminSelect (Admin Polish Pass 1), built specifically
// for Recipe ingredient item fields — a list that can run into the dozens
// where jumping straight to a name via type-ahead is slower than filtering.
// A deliberate SEPARATE component rather than a "searchable" mode bolted
// onto AdminSelect itself: the two have genuinely different focus models
// (AdminSelect never moves focus off its trigger button, using
// aria-activedescendant exactly per the APG "Select Only Combobox"
// pattern; here, focus moves INTO a real search <input> the moment the
// panel opens, since "the search field is the typing surface" is the
// whole point) — conflating them would have doubled every keyboard branch
// in an already load-bearing, thoroughly-tested component. Every other
// architectural piece (portal target, panel positioning/flip, outside-
// click, the visually-hidden proxy field, FORM_CHANGE_EVENT dispatch) is
// copied deliberately close to AdminSelect's own proven implementation.
//
// Accessible-name / test-query note: the TRIGGER button keeps
// role="combobox" (never the search input), matching AdminSelect exactly,
// so e2e/helpers/admin-select.ts's existing getByRole("combobox")-based
// helper keeps working unchanged for the common "open, click the option
// you want" flow — searching first is optional, not required, to select
// anything. The search input itself is a plain textbox (no combobox role
// of its own, which would create two simultaneously-queryable comboboxes
// in the DOM); the trigger's aria-expanded/aria-controls/aria-
// activedescendant stay authoritative for the open listbox even while the
// search input actually holds DOM focus — a pragmatic, documented
// deviation from a textbook single-element ARIA combobox, chosen so the
// existing "one stable combobox per field" test convention never breaks.
//
// Tab-continuation note: because the open panel (and its search input)
// renders through the SAME portal AdminSelect uses (see admin-select.tsx's
// own module comment for why), it is not a DOM sibling of the trigger —
// so letting a real Tab keypress fall through naturally from the portaled
// search input would jump focus to wherever the portal root happens to
// sit in the document, not to the very next field in this ingredient row.
// Tab is handled explicitly instead: close the panel and move focus to
// whatever element actually follows the trigger in real document order.

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import { ResourceIcon } from "@/components/admin/resource-icon";
import type { AdminSelectOption } from "@/components/admin/admin-select";

export type SearchableAdminSelectProps = {
  name: string;
  options: readonly AdminSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  formId?: string;
  id?: string;
  className?: string;
  /** Placeholder text for the internal search field (e.g. "Search
      items…"). */
  searchPlaceholder?: string;
  /** Shown in place of the option list when the query matches nothing. */
  noResultsLabel?: string;
};

// Broad on purpose — the actual "is this really focusable" test below
// checks the resolved .tabIndex property (not just the presence of a
// tabindex attribute), since CSS attribute selectors alone cannot exclude
// a plain input:not([type="hidden"]) that ALSO happens to carry
// tabindex="-1" (exactly what every AdminSelect/SearchableAdminSelect
// proxy field is) — an earlier version of this selector let the proxy
// input count as "the next focusable element," landing Tab on it instead
// of the real next field.
const FOCUS_CANDIDATE_SELECTOR = "button, [href], input, select, textarea, [tabindex]";

function getPortalContainer(): Element | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById("admin-select-portal-root") ?? document.body;
}

function focusRelativeTo(anchor: HTMLElement, direction: 1 | -1) {
  const focusable = Array.from(
    document.querySelectorAll<HTMLElement>(FOCUS_CANDIDATE_SELECTOR)
  ).filter((el) => el.tabIndex !== -1 && !el.hasAttribute("disabled"));
  const index = focusable.indexOf(anchor);
  if (index < 0) {
    return;
  }
  const target = focusable[index + direction];
  target?.focus();
}

export function SearchableAdminSelect({
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
  searchPlaceholder = "Search…",
  noResultsLabel = "No results match your search.",
}: SearchableAdminSelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelPosition, setPanelPosition] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const proxyRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const mountedRef = useRef(false);

  const selectedIndex = options.findIndex((option) => option.value === currentValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(trimmed)
    );
  }, [query, options]);

  function commit(newValue: string) {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  }

  // Same deterministic AdminFormGuard signal AdminSelect dispatches — see
  // its own module comment. Never fired for query changes (the proxy's
  // value only changes on an actual selection), which is exactly what
  // keeps searching from marking the form dirty.
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

  function updatePanelPosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const direction = spaceBelow < 280 && spaceAbove > spaceBelow ? "up" : "down";
    setPanelPosition(
      direction === "up"
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4 }
        : { left: rect.left, width: rect.width, top: rect.bottom + 4 }
    );
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePanelPosition();
    window.addEventListener("scroll", updatePanelPosition, true);
    window.addEventListener("resize", updatePanelPosition);
    return () => {
      window.removeEventListener("scroll", updatePanelPosition, true);
      window.removeEventListener("resize", updatePanelPosition);
    };
  }, [open]);

  // Focus moves into the search field the instant the panel opens — the
  // one behavior this component adds beyond AdminSelect's own trigger-
  // keeps-focus model. Depends on panelPosition (not just `open`): the
  // portal (and the search input inside it) only actually mounts once
  // panelPosition is computed by the layout effect below, one render
  // after `open` itself flips true — focusing here on `open` alone would
  // fire before the input exists.
  useEffect(() => {
    if (open && panelPosition) {
      searchInputRef.current?.focus();
    }
  }, [open, panelPosition]);

  function openPanel() {
    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : -1);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setQuery("");
  }

  function selectActive() {
    const option = filteredOptions[activeIndex];
    if (option && !option.disabled) {
      commit(option.value);
    }
    closePanel();
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    const printable =
      event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPanel();
      return;
    }
    if (printable) {
      event.preventDefault();
      setQuery(event.key);
      setActiveIndex(-1);
      setOpen(true);
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((current) => {
          for (let i = current + 1; i < filteredOptions.length; i += 1) {
            if (!filteredOptions[i].disabled) return i;
          }
          return current;
        });
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((current) => {
          for (let i = current - 1; i >= 0; i -= 1) {
            if (!filteredOptions[i].disabled) return i;
          }
          return current;
        });
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(filteredOptions.findIndex((option) => !option.disabled));
        return;
      case "End": {
        event.preventDefault();
        for (let i = filteredOptions.length - 1; i >= 0; i -= 1) {
          if (!filteredOptions[i].disabled) {
            setActiveIndex(i);
            return;
          }
        }
        return;
      }
      case "Enter":
        event.preventDefault();
        selectActive();
        return;
      case "Escape":
        event.preventDefault();
        closePanel();
        triggerRef.current?.focus();
        return;
      case "Tab": {
        event.preventDefault();
        closePanel();
        const trigger = triggerRef.current;
        if (trigger) {
          focusRelativeTo(trigger, event.shiftKey ? -1 : 1);
        }
        return;
      }
      default:
        return;
    }
  }

  const activeId =
    open && activeIndex >= 0 && filteredOptions[activeIndex]
      ? `${listboxId}-option-${filteredOptions[activeIndex].value || "empty"}-${activeIndex}`
      : undefined;
  const portalContainer = open && panelPosition ? getPortalContainer() : null;

  return (
    <div ref={rootRef} className="admin-select searchable-admin-select">
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
            closePanel();
          } else {
            openPanel();
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
            <div
              ref={panelRef}
              className="admin-select-panel searchable-admin-select-panel"
              style={{
                position: "fixed",
                left: panelPosition.left,
                width: panelPosition.width,
                top: panelPosition.top,
                bottom: panelPosition.bottom,
              }}
            >
              <div className="searchable-admin-select-search">
                <Search aria-hidden="true" className="searchable-admin-select-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="searchable-admin-select-search-input"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  aria-label={searchPlaceholder}
                  // Never submitted and never dirties the form: no name
                  // attribute means it is simply absent from FormData.
                />
              </div>
              {filteredOptions.length === 0 ? (
                <p className="searchable-admin-select-no-results">
                  {noResultsLabel}
                </p>
              ) : (
                <ul role="listbox" id={listboxId}>
                  {filteredOptions.map((option, index) => (
                    <li
                      key={option.value}
                      id={`${listboxId}-option-${option.value || "empty"}-${index}`}
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
                        closePanel();
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
                </ul>
              )}
            </div>,
            portalContainer
          )
        : null}

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
