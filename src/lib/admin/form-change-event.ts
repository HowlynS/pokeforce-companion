// One shared, explicit "a form field changed programmatically" signal
// (Opus Pass 2 hardening). Some admin field components update a DOM value
// that the AdminFormGuard's dirty comparison must see, but do so WITHOUT a
// native input/change event bubbling to the form:
//   - RecordSlugField: the Page-address <input> is React-controlled, so
//     when it auto-syncs from Name, React writes its value with no native
//     input event.
//   - DateField: the visible text input carries no `name`; the value that
//     actually submits lives in a separate hidden <input> whose value
//     React derives — again with no native event on that hidden input.
//
// Dispatching a real native input event on those controlled elements is
// unsafe (React would treat it as user input — e.g. RecordSlugField would
// flip to "manual" mode). So instead each such component dispatches THIS
// dedicated bubbling CustomEvent when its committed value changes. The
// guard listens for it and recomputes deterministically — no 60ms guess.
// Because it is a custom event name React does not handle, it can never
// trigger a component's own onChange or cause a feedback loop, and any
// form without a guard simply ignores it.

export const FORM_CHANGE_EVENT = "pf:form-change";

/** Dispatches the shared form-change signal from `element`, bubbling up to
    the enclosing <form> where the guard (if any) is listening. A no-op when
    the element is null or events are unavailable. */
export function dispatchFormChange(element: Element | null | undefined): void {
  if (!element) {
    return;
  }
  try {
    element.dispatchEvent(new CustomEvent(FORM_CHANGE_EVENT, { bubbles: true }));
  } catch {
    // CustomEvent unavailable (non-DOM environment) — nothing to signal.
  }
}
