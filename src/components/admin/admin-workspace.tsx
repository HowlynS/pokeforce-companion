// The structural composition every later resource workspace builds on
// (Slice 9B.1): a header region across the top, then up to three columns —
// an optional record-list column, the primary editor/content region, and
// an optional contextual side panel. This pass defines the slots only; no
// page supplies a record list or side panel yet (that is later Slice 9B
// work), and when a slot is absent its column simply does not exist — no
// reserved empty space.
//
// One shared implementation, not five resource-specific shells: a
// resource workspace passes its own content into these slots rather than
// arranging its own columns. Deliberately NOT a generic layout framework —
// exactly one header and three body slots, nothing configurable beyond
// presence.

type AdminWorkspaceProps = {
  /** The page-level header region — typically a PageHeader plus any
      toolbar/status banners that belong above BOTH body columns. Editor
      pages (create/edit/tab routes) no longer pass this: their own
      eyebrow/title/tabs/error now render inside the new `editorHeader`
      slot instead (Visual Pass II, Section 3), so the selected-record
      header never spans over the record-list column beside it. Only
      list/landing pages and the dashboard still use this slot. */
  header?: React.ReactNode;
  /** Optional record-list column (a later slice's searchable list);
      rendered to the LEFT of the primary region when present. */
  recordList?: React.ReactNode;
  /** The selected record's own EditorHeader/EditorTabs/error banner
      (Visual Pass II correction pass, Section 3): rendered ABOVE the
      main-editor-card/context-rail row, but INSIDE the same editor
      column as that row — never spanning over the record-list column
      beside it, and never a sibling of the aside at the record-list's
      own top edge. Editor pages pass this instead of stacking that
      content at the top of `children`; pages with no such header (rare)
      simply omit it. */
  editorHeader?: React.ReactNode;
  /** Optional contextual side panel (a later slice's image/verification/
      timestamp panels); rendered to the RIGHT of the primary region,
      inside the same row as `children` — BELOW `editorHeader`, so its
      own top edge aligns with the main editor card's top edge instead of
      the record-list column's top edge. */
  aside?: React.ReactNode;
  /** The primary editor/content region. */
  children: React.ReactNode;
};

export function AdminWorkspace({
  header,
  recordList,
  editorHeader,
  aside,
  children,
}: AdminWorkspaceProps) {
  return (
    <div className="admin-workspace">
      {header ? <div className="admin-workspace-header">{header}</div> : null}

      <div className="admin-workspace-body">
        {recordList ? (
          <div className="admin-workspace-record-list">{recordList}</div>
        ) : null}

        {/* The editor column: header/tabs stacked above the main-card +
            aside row, so the aside's own top edge lines up with the main
            editor card's top edge rather than the record-list's. */}
        <div className="admin-workspace-editor">
          {editorHeader ? (
            <div className="admin-workspace-editor-header">{editorHeader}</div>
          ) : null}

          <div className="admin-workspace-editor-row">
            <div className="admin-workspace-main">{children}</div>

            {aside ? (
              <div className="admin-workspace-aside">{aside}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
