import { describe, expect, it, vi } from "vitest";
import {
  FORM_CHANGE_EVENT,
  dispatchFormChange,
} from "@/lib/admin/form-change-event";

// The helper only needs an object with a `dispatchEvent` method and a
// working CustomEvent — verified here without a full DOM by stubbing both.
describe("dispatchFormChange", () => {
  it("uses the stable shared event name", () => {
    expect(FORM_CHANGE_EVENT).toBe("pf:form-change");
  });

  it("dispatches a bubbling CustomEvent of the shared name from the element", () => {
    const events: Event[] = [];
    const element = {
      dispatchEvent: (event: Event) => {
        events.push(event);
        return true;
      },
    } as unknown as Element;

    dispatchFormChange(element);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(FORM_CHANGE_EVENT);
    expect(events[0].bubbles).toBe(true);
  });

  it("is a no-op for a null/undefined element (never throws)", () => {
    expect(() => dispatchFormChange(null)).not.toThrow();
    expect(() => dispatchFormChange(undefined)).not.toThrow();
  });

  it("swallows a dispatch failure rather than propagating it", () => {
    const element = {
      dispatchEvent: vi.fn(() => {
        throw new Error("no DOM");
      }),
    } as unknown as Element;
    expect(() => dispatchFormChange(element)).not.toThrow();
  });
});
