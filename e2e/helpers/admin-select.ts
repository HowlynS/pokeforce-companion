// Shared E2E interaction helper for AdminSelect (Massive Admin Interaction
// Completion Pass, Phase 1) — the accessible custom dropdown that replaced
// the native <select> controls throughout the admin workspace. Playwright's
// built-in `locator.selectOption()` only works on a real <select> DOM
// element; AdminSelect's trigger resolves correctly via
// `getByRole("combobox", { name })` (its accessible name still comes from
// the same wrapping <label> a native select used), but must be driven by
// clicking it open and then clicking the desired option, exactly like a
// real user would. Every existing spec that used `.selectOption()` on a
// field this pass converted now goes through this helper instead — no
// other change to those tests' own intent or assertions.

import type { Locator } from "@playwright/test";

/** Opens an AdminSelect (already resolved via getByRole("combobox", ...))
    and clicks the option with the given exact accessible name. Scopes the
    option lookup to the specific listbox this combobox owns (via its own
    aria-controls), so multiple AdminSelects on one page can never create
    an ambiguous match even if more than one happened to be open. */
export async function selectAdminOption(
  combobox: Locator,
  optionLabel: string
): Promise<void> {
  await combobox.click();
  const page = combobox.page();
  const listboxId = await combobox.getAttribute("aria-controls");
  const listbox = listboxId
    ? page.locator(`#${listboxId}`)
    : page.getByRole("listbox");
  await listbox.getByRole("option", { name: optionLabel, exact: true }).click();
}
