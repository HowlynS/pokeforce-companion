import { Save } from "lucide-react";

// Shared sticky editor actions (Slice 9B.2; Delete moved to the aside
// column's DangerZonePanel in Visual Pass sub-slice 9; Save/Cancel visual
// consistency pass in Visual Pass II Section 6; Cancel-left/primary-right
// order made universal in the Visual Pass II correction pass — the prior
// per-form `cancelFirst` toggle left create forms rendering primary-first,
// which is the same defect this row exists to prevent everywhere else):
// the save/cancel row pinned to the bottom of the scrolling content area.
// Rendered INSIDE the resource's <form>, so the submit button keeps plain
// HTML form submission — no client-side mutation architecture. The sticky
// bar is opaque with a top border, so fields scroll under it without ever
// being unreadable behind it, and every control is an ordinary button or
// link, reachable by keyboard in DOM order. Deliberately Save/Cancel only
// now — Delete never renders in this bar, so the destructive action can
// never sit next to Save. Delete-confirmation pages are a separate,
// unrelated markup pattern and are not affected by this order.

type EditorActionsProps = {
  submitLabel: string;
  cancelHref: string;
  cancelLabel?: string;
};

export function EditorActions({
  submitLabel,
  cancelHref,
  cancelLabel = "Cancel",
}: EditorActionsProps) {
  return (
    <div className="admin-editor-actions">
      <a href={cancelHref} className="btn btn-cancel">
        {cancelLabel}
      </a>

      <button type="submit" className="btn btn-primary admin-editor-submit">
        <Save aria-hidden="true" className="admin-editor-submit-icon" />
        {submitLabel}
      </button>
    </div>
  );
}
