// Shared editor tab navigation (Slice 9B.2): link-based tabs, so a tab
// can target another route ("/admin/items/x/edit") or a query state
// ("?tab=sources") without this component forcing either architecture —
// the CALLER decides each tab's href and which one is active. Plain
// links keep every tab keyboard-reachable, and aria-current="page" on
// the active tab is simultaneously the accessible marker and the CSS
// styling hook. No resource-specific tab names live here.
//
// A tab whose destination doesn't exist yet (Slice 9B.5: Acquisition
// Sources, Used in Recipes, Metadata content) sets `disabled` instead of
// a real href — it renders as inert text, never a link to an empty page.
//
// Relationship-count badges (Phase B sub-slice): `count` is optional —
// undefined renders no badge at all (General and every other
// non-relationship tab simply never sets it), while any number (0
// included) renders a compact pill. The badge is a plain <span> inside
// the existing tab <a>/<span> — never a second link or button, so it can
// never become its own focus target or change keyboard behavior. It is
// entirely `aria-hidden`: a purely visual preview for scanning the tab
// strip, deliberately NOT folded into the tab's own accessible name.
// Every tab's accessible name stays exactly its plain label in every
// case — an invariant the rest of the admin E2E suite already depends on
// via exact-name role queries — and the same count is already available
// as ordinary accessible text once the tab's own content loads (a
// relationship list, table, or panel description), so nothing is lost to
// assistive tech, only announced at a different, less redundant moment.
export type EditorTab = {
  label: string;
  href: string;
  active: boolean;
  /** Renders as a non-interactive placeholder instead of a link. */
  disabled?: boolean;
  /** Relationship-record count shown as a compact badge beside the
      label. Undefined omits the badge entirely; 0 still renders "0". */
  count?: number;
};

type EditorTabsProps = {
  /** Accessible name for this tab navigation (e.g. "Item editor sections"). */
  label: string;
  tabs: readonly EditorTab[];
};

function TabBadge({ count }: { count: number }) {
  return (
    <span className="admin-tab-badge" aria-hidden="true">
      {count}
    </span>
  );
}

export function EditorTabs({ label, tabs }: EditorTabsProps) {
  return (
    <nav aria-label={label} className="admin-tabs">
      {tabs.map((tab) =>
        tab.disabled ? (
          <span
            key={tab.label}
            className="admin-tab admin-tab-disabled"
            aria-disabled="true"
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <TabBadge count={tab.count} />
            ) : null}
          </span>
        ) : (
          <a
            key={tab.label}
            href={tab.href}
            className="admin-tab"
            aria-current={tab.active ? "page" : undefined}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <TabBadge count={tab.count} />
            ) : null}
          </a>
        )
      )}
    </nav>
  );
}
