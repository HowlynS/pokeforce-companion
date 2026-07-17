// Shared editor tab navigation (Slice 9B.2): link-based tabs, so a tab
// can target another route ("/admin/items/x/edit") or a query state
// ("?tab=sources") without this component forcing either architecture —
// the CALLER decides each tab's href and which one is active. Plain
// links keep every tab keyboard-reachable, and aria-current="page" on
// the active tab is simultaneously the accessible marker and the CSS
// styling hook. No resource-specific tab names live here.

export type EditorTab = {
  label: string;
  href: string;
  active: boolean;
};

type EditorTabsProps = {
  /** Accessible name for this tab navigation (e.g. "Item editor sections"). */
  label: string;
  tabs: readonly EditorTab[];
};

export function EditorTabs({ label, tabs }: EditorTabsProps) {
  return (
    <nav aria-label={label} className="admin-tabs">
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className="admin-tab"
          aria-current={tab.active ? "page" : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
