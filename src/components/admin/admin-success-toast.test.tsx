// Structural component test for AdminSuccessToast, rendered to static HTML
// with react-dom/server (Node-only, no DOM library — the established
// component-test approach; see admin-form-guard.test.tsx's own docstring).
// The toast's actual appearance, auto-dismiss timer, manual dismiss
// button, and URL-cleanup-on-consumption all depend on a mount effect
// (which never runs in a static render) and on next/navigation's router
// context, so — exactly like AdminFormGuard's own dirty-state/draft/
// navigation behavior — those stay E2E-only (see
// e2e/admin-success-toast.spec.ts). What a static render CAN prove
// directly: given no recognized `success` param, the component renders
// nothing at all, both before and after the (never-run) effect. The
// message-mapping and URL-cleanup logic themselves are unit-tested
// directly, as pure functions, in success-messages.test.ts.
//
// next/navigation's useSearchParams/usePathname are mocked (same pattern
// as admin-form-guard.test.tsx's own useRouter mock) since the component
// calls them unconditionally.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let mockSearch = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => "/admin/items/iron-ore/edit",
}));

import { AdminSuccessToast } from "@/components/admin/admin-success-toast";

describe("AdminSuccessToast: static (pre-effect) render", () => {
  it("renders nothing when there is no success param", () => {
    mockSearch = "";
    const html = renderToStaticMarkup(<AdminSuccessToast />);
    expect(html).toBe("");
  });

  it("renders nothing for an unrecognized success code", () => {
    mockSearch = "success=not_a_real_code";
    const html = renderToStaticMarkup(<AdminSuccessToast />);
    expect(html).toBe("");
  });

  it("renders nothing on the initial static pass even for a recognized code, since the message only appears via the mount effect", () => {
    // This is the same "safe before detection" shape SaveShortcutLabel
    // proves: renderToStaticMarkup never runs effects, so this confirms
    // there is no synchronous/render-time flash of content before the
    // effect has had a chance to run (and, on the server, never will).
    mockSearch = "success=item_saved";
    const html = renderToStaticMarkup(<AdminSuccessToast />);
    expect(html).toBe("");
  });
});
