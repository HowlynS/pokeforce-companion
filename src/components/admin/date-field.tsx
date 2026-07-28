"use client";

import { DayPicker } from "@daypicker/react";
import { CalendarDays } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import { formatIsoToDateEntryText } from "@/lib/date-field";

type DateFieldProps = {
  /** Form field receiving the existing YYYY-MM-DD date-only value. */
  name: string;
  /** Visible field label. */
  label: string;
  /** Persisted YYYY-MM-DD value, or null/undefined for no selected date. */
  defaultValue?: string | null;
  /** Optional fields expose an explicit clear action. */
  clearable?: boolean;
  /** Override when a field needs a more specific trigger name. */
  triggerLabel?: string;
};

type PopoverPosition = {
  left: number;
  top: number;
  placement: "above" | "below";
  ready: boolean;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POPOVER_GAP = 8;
const VIEWPORT_MARGIN = 12;

function dateFromIso(iso: string | null | undefined): Date | undefined {
  const match = iso ? ISO_DATE_PATTERN.exec(iso) : null;
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return undefined;
  }
  return date;
}

function isoFromDate(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fieldNameFromLabel(label: string): string {
  return label.replace(/\s*\(optional\)\s*$/i, "").trim().toLowerCase();
}

export function DateField({
  name,
  label,
  defaultValue,
  clearable = true,
  triggerLabel,
}: DateFieldProps) {
  const generatedId = useId();
  const fieldId = `date-field-${generatedId.replaceAll(":", "")}`;
  const helperId = `${fieldId}-helper`;
  const dialogId = `${fieldId}-dialog`;
  const hiddenRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const initialDate = useMemo(() => dateFromIso(defaultValue), [defaultValue]);
  const [isoValue, setIsoValue] = useState(() =>
    initialDate ? isoFromDate(initialDate) : ""
  );
  const [month, setMonth] = useState(() => initialDate ?? new Date());
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({
    left: 0,
    top: 0,
    placement: "below",
    ready: false,
  });
  const selected = useMemo(() => dateFromIso(isoValue), [isoValue]);
  const visibleValue = formatIsoToDateEntryText(isoValue);
  const fieldName = fieldNameFromLabel(label);
  const accessibleTriggerLabel =
    triggerLabel ?? `Choose ${fieldName || "date"}`;

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    dispatchFormChange(hiddenRef.current);
  }, [isoValue]);

  const closePopover = useCallback((restoreFocus = true) => {
    setOpen(false);
    setPosition((current) => ({ ...current, ready: false }));
    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, []);

  const updatePopoverPosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) {
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const availableBelow =
      window.innerHeight - anchorRect.bottom - VIEWPORT_MARGIN;
    const availableAbove = anchorRect.top - VIEWPORT_MARGIN;
    const placement =
      availableBelow < popoverRect.height && availableAbove > availableBelow
        ? "above"
        : "below";
    const idealTop =
      placement === "above"
        ? anchorRect.top - popoverRect.height - POPOVER_GAP
        : anchorRect.bottom + POPOVER_GAP;
    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        idealTop,
        window.innerHeight - popoverRect.height - VIEWPORT_MARGIN
      )
    );
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        anchorRect.left,
        window.innerWidth - popoverRect.width - VIEWPORT_MARGIN
      )
    );
    setPosition({ left, top, placement, ready: true });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = window.requestAnimationFrame(updatePopoverPosition);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !anchorRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        closePopover();
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopover();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [closePopover, open, updatePopoverPosition]);

  function openPopover() {
    if (selected) {
      setMonth(selected);
    }
    setOpen(true);
  }

  function handleFieldKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openPopover();
    }
  }

  function handleSelect(date: Date | undefined) {
    if (!date) {
      if (clearable) {
        setIsoValue("");
        closePopover();
      }
      return;
    }
    setIsoValue(isoFromDate(date));
    setMonth(date);
    closePopover();
  }

  function handleClear() {
    setIsoValue("");
    setMonth(new Date());
    closePopover();
  }

  const startYear = Math.min(1900, selected?.getFullYear() ?? 1900);
  const endYear = Math.max(
    new Date().getFullYear() + 20,
    selected?.getFullYear() ?? 0
  );
  const calendarLabel = `Calendar, ${month.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })}`;

  return (
    <div className="form-field admin-date-field">
      <span id={`${fieldId}-label`} className="form-field-label">
        {label}
      </span>

      <div ref={anchorRef} className="admin-date-control">
        <input
          id={fieldId}
          type="text"
          inputMode="none"
          autoComplete="off"
          placeholder="DD MMM YYYY"
          className="form-input admin-date-input"
          value={visibleValue}
          readOnly
          aria-labelledby={`${fieldId}-label`}
          aria-describedby={helperId}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          onClick={openPopover}
          onKeyDown={handleFieldKeyDown}
        />
        <button
          ref={triggerRef}
          type="button"
          className="admin-date-trigger"
          aria-label={accessibleTriggerLabel}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          aria-expanded={open}
          onClick={() => (open ? closePopover(false) : openPopover())}
          onKeyDown={handleFieldKeyDown}
        >
          <CalendarDays aria-hidden="true" />
        </button>
      </div>

      <p id={helperId} className="form-field-helper">
        Select a date. Display format: DD MMM YYYY.
      </p>

      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        value={isoValue}
        onInput={(event) => {
          const restored = event.currentTarget.value;
          const restoredDate = dateFromIso(restored);
          setIsoValue(restoredDate ? isoFromDate(restoredDate) : "");
          if (restoredDate) {
            setMonth(restoredDate);
          }
        }}
      />

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id={dialogId}
              className="admin-date-popover"
              data-placement={position.placement}
              data-ready={position.ready ? "true" : "false"}
              role="dialog"
              aria-label={accessibleTriggerLabel}
              style={{ left: position.left, top: position.top }}
            >
              <DayPicker
                className="admin-date-calendar"
                mode="single"
                selected={selected}
                month={month}
                onMonthChange={setMonth}
                onSelect={handleSelect}
                autoFocus
                role="application"
                aria-label={calendarLabel}
                captionLayout="dropdown"
                navLayout="after"
                reverseYears
                fixedWeeks
                showOutsideDays
                startMonth={new Date(startYear, 0, 1, 12)}
                endMonth={new Date(endYear, 11, 1, 12)}
                footer={
                  selected
                    ? `Selected date: ${formatIsoToDateEntryText(isoValue)}`
                    : "No date selected"
                }
              />
              <div className="admin-date-popover-actions">
                {clearable ? (
                  <button
                    type="button"
                    className="btn btn-secondary admin-date-clear"
                    onClick={handleClear}
                    disabled={!selected}
                  >
                    Clear date
                  </button>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
