// The ONE locator for an admin editor's Description field.
//
// Every admin Description field is now the shared RichDescriptionEditor
// (a contenteditable `role="textbox"`), not a plain `<textarea>`. That
// editor renders TWO elements whose accessible name begins with
// "Description": the formatting toolbar ("Description formatting") and
// the editor itself ("Description (optional)"). The older specs reached
// for `getByLabel(/^Description/)`, which matched both once the toolbar
// arrived and failed Playwright's strict-mode check — the single most
// common cause of stale admin E2E failures.
//
// Matching on the role AND the exact accessible name is both narrower
// and more stable than the old regex: it names the control a person
// actually types into, and it cannot start matching a sibling again if
// another labelled element is added beside it later.
//
// Note for callers: this is a contenteditable, not a form control, so
// its content is asserted with `toHaveText`, never `toHaveValue`.
// `fill()` and `press()` work on it exactly as they do on a textarea.

import type { Locator, Page } from "@playwright/test";

export function descriptionEditor(page: Page): Locator {
  return page.getByRole("textbox", {
    name: "Description (optional)",
    exact: true,
  });
}
