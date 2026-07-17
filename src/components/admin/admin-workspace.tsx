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
  /** The page/workspace header region — typically a PageHeader, plus any
      toolbar and status banners that belong above the body columns. */
  header: React.ReactNode;
  /** Optional record-list column (a later slice's searchable list);
      rendered to the LEFT of the primary region when present. */
  recordList?: React.ReactNode;
  /** Optional contextual side panel (a later slice's image/verification/
      timestamp panels); rendered to the RIGHT of the primary region when
      present. */
  aside?: React.ReactNode;
  /** The primary editor/content region. */
  children: React.ReactNode;
};

export function AdminWorkspace({
  header,
  recordList,
  aside,
  children,
}: AdminWorkspaceProps) {
  return (
    <div className="admin-workspace">
      <div className="admin-workspace-header">{header}</div>

      <div className="admin-workspace-body">
        {recordList ? (
          <div className="admin-workspace-record-list">{recordList}</div>
        ) : null}

        <div className="admin-workspace-main">{children}</div>

        {aside ? <div className="admin-workspace-aside">{aside}</div> : null}
      </div>
    </div>
  );
}
