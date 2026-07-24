"use client";

// Shared image panel (Slice 9B.2; redesigned in Visual Pass sub-slice 6;
// gained an immediate client-side preview in Admin Polish Pass 1): a large
// centered preview (or an intentional empty placeholder), compact helper
// copy, a gold Choose/Change Image action, and a separate icon-only trash
// button — one shared implementation for Items, Recipes, Professions,
// Categories, and Locations rather than near-identical markup repeated on
// every edit page. Upload, replacement, removal, validation, storage, and
// cleanup behavior all stay exactly where they were (the resource's own
// form and server action) — this component only owns the file input
// itself, the existing removeImage checkbox, the client-side filename
// echo, and now a purely visual local preview, none of which touch the
// server contract: the same "image"/"removeImage" field names submit with
// the resource's <form> via the standard HTML `form` attribute, exactly
// as before, and nothing is ever uploaded from here.
//
// Preview precedence: a newly selected file (previewUrl) always wins over
// everything else — it is the most specific, most recent signal of intent
// — then the removeImage checkbox's own checked state (removed), then
// finally the record's persisted imageUrl. This mirrors, rather than
// replaces, the existing form-level validation that already rejects
// choosing a replacement AND removal together (conflicting_image_input);
// the preview simply shows the file, the server remains the sole
// authority on whether that combination is allowed to save.
//
// Object URLs are created only from the browser-local File the contributor
// just chose (URL.createObjectURL) — never uploaded, never touching
// Supabase Storage or any server action — and are revoked deterministically
// by the effect below whenever a new one replaces it and on unmount, so a
// contributor swapping files repeatedly never leaks blob URLs.
//
// Dirty-tracking and drafts need NO new code here: AdminFormGuard's own
// document-level input/change listener already treats this file input like
// any other form-associated control (it carries the standard `form`
// attribute), and form-snapshot.ts already represents a file input as a
// non-restorable "presence marker" (name/size/lastModified, never bytes) —
// selecting a file already marked the form dirty and was already excluded
// from drafts before this pass; this preview is purely additive.
//
// A client component only for three purposes now: making the native file
// input keyboard-accessible behind a real <button> (a <label> alone is not
// focusable/operable by keyboard), echoing the selected file's name after a
// choice is made, and driving the local preview described above. Every
// other behavior — including the remove-toggle's confirmation-note
// reveal — stays pure CSS via the existing checkbox+sibling-selector
// pattern; canceling the OS file picker can still never affect the
// removeImage checkbox or the currently stored image.

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { ContextPanel } from "@/components/admin/context-panel";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

const HELPER_TEXT = "PNG, JPEG or WebP · Max 5 MB";

type ImagePanelProps = {
  title?: string;
  /** The record's current stored image URL, or null when none exists. */
  imageUrl: string | null;
  /** Required whenever imageUrl is set; ignored otherwise. */
  imageAlt?: string;
  /** Associates the file input (and, when present, the remove checkbox)
      with a <form> element elsewhere in the document — needed because
      this panel renders in the workspace's aside column, outside the
      resource's own <form>. */
  formId: string;
  fieldName?: string;
  removeFieldName?: string;
};

export function ImagePanel({
  title = "Image",
  imageUrl,
  imageAlt = "",
  formId,
  fieldName = "image",
  removeFieldName = "removeImage",
}: ImagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  // Purely local, purely visual — never uploaded, never persisted, never
  // part of a draft (see the module comment).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const removeCheckboxId = `${formId}-${removeFieldName}`;

  // Revokes the PREVIOUS object URL whenever a new one replaces it, and
  // the current one on unmount — the one place this preview's blob URLs
  // are ever released.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Precedence: a freshly chosen file always wins; otherwise show the
  // removed (empty) state if Remove is checked; otherwise the persisted
  // image. See the module comment for why a file selected while Remove is
  // also checked still previews (the server alone rejects that combination).
  const displayImageUrl = previewUrl ?? (removed ? null : imageUrl);

  return (
    <ContextPanel title={title} icon={SECTION_ICONS.image}>
      <div className="admin-image-panel-body">
        {imageUrl ? (
          <input
            type="checkbox"
            name={removeFieldName}
            id={removeCheckboxId}
            form={formId}
            className="admin-image-remove-checkbox"
            onChange={(event) => setRemoved(event.target.checked)}
          />
        ) : null}

        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-only preview; remote next/image configuration is deferred to the public-display slice
          <img
            src={displayImageUrl}
            alt={imageAlt}
            className="admin-image-preview-lg"
          />
        ) : (
          <div className="admin-image-empty-lg">No image uploaded.</div>
        )}

        <p className="admin-image-helper">{HELPER_TEXT}</p>

        <div className="admin-image-actions">
          <button
            type="button"
            className="btn btn-primary btn-compact"
            onClick={() => fileInputRef.current?.click()}
          >
            {imageUrl ? "Change Image" : "Choose Image"}
          </button>

          {imageUrl ? (
            <label
              htmlFor={removeCheckboxId}
              className="admin-image-trash-btn"
              aria-label="Remove image"
              title="Remove image"
            >
              <Trash2 aria-hidden="true" />
            </label>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          name={fieldName}
          accept="image/png,image/jpeg,image/webp"
          form={formId}
          tabIndex={-1}
          className="admin-image-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // No file (e.g. a cancelled re-open of the picker, which per
            // the module comment never even fires a change event in
            // practice) leaves everything — filename echo, preview,
            // stored image — exactly as it was.
            if (!file) {
              return;
            }
            setSelectedFileName(file.name);
            setPreviewUrl(URL.createObjectURL(file));
          }}
        />

        {selectedFileName ? (
          <p className="admin-image-filename">{selectedFileName}</p>
        ) : null}

        {imageUrl ? (
          <p className="admin-image-remove-note">
            Image will be removed when saved.
          </p>
        ) : null}
      </div>
    </ContextPanel>
  );
}
