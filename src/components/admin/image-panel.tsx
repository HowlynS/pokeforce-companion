// Shared image panel (Slice 9B.2): a structural ContextPanel wrapper the
// resource workspaces place their EXISTING image controls into — the
// current preview, remove toggle, and file input markup move in as
// children unchanged. Upload, replacement, removal, validation, storage,
// and cleanup behavior all stay exactly where they are (the resource's
// form and server action); this wrapper only provides the panel frame
// and the interactive-cursor treatment every upload surface must have
// (see .admin-image-panel-body in globals.css). Works identically for
// Items, Recipes, Professions, and Locations because it knows nothing
// about any of them.

import { ContextPanel } from "@/components/admin/context-panel";

type ImagePanelProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export function ImagePanel({
  title = "Image",
  description,
  children,
}: ImagePanelProps) {
  return (
    <ContextPanel title={title} description={description}>
      <div className="admin-image-panel-body">{children}</div>
    </ContextPanel>
  );
}
