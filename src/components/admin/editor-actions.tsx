// Shared sticky editor actions (Slice 9B.2): the save/cancel row pinned
// to the bottom of the scrolling content area, with an optional delete
// action pushed to the far edge so the destructive control never sits
// next to Save. Rendered INSIDE the resource's <form>, so the submit
// button keeps plain HTML form submission — no client-side mutation
// architecture. The sticky bar is opaque with a top border, so fields
// scroll under it without ever being unreadable behind it, and every
// control is an ordinary button or link, reachable by keyboard in DOM
// order. Delete is a LINK to the resource's existing confirmation route,
// matching the established deletion pattern.

type EditorActionsProps = {
  submitLabel: string;
  cancelHref: string;
  cancelLabel?: string;
  /** Optional destructive action: links to the existing delete
      confirmation route — never a direct destructive submit. */
  deleteHref?: string;
  deleteLabel?: string;
};

export function EditorActions({
  submitLabel,
  cancelHref,
  cancelLabel = "Cancel",
  deleteHref,
  deleteLabel = "Delete",
}: EditorActionsProps) {
  return (
    <div className="admin-editor-actions">
      <button type="submit" className="btn btn-primary">
        {submitLabel}
      </button>

      <a href={cancelHref} className="btn btn-secondary">
        {cancelLabel}
      </a>

      {deleteHref ? (
        <>
          <span className="admin-editor-actions-spacer" aria-hidden="true" />
          <a href={deleteHref} className="btn btn-danger">
            {deleteLabel}
          </a>
        </>
      ) : null}
    </div>
  );
}
