"use client";

// Shared image panel (Slice 9B.2; redesigned in Visual Pass sub-slice 6):
// a large centered preview (or an intentional empty placeholder), compact
// helper copy, a gold Choose/Change Image action, and a separate
// icon-only trash button — one shared implementation for Items, Recipes,
// Professions, and Locations rather than near-identical markup repeated
// on every edit page. Upload, replacement, removal, validation, storage,
// and cleanup behavior all stay exactly where they were (the resource's
// own form and server action) — this component only owns the file input
// itself, the existing removeImage checkbox, and the client-side
// filename echo, none of which touch the server contract: the same
// "image"/"removeImage" field names submit with the resource's <form>
// via the standard HTML `form` attribute, exactly as before.
//
// A client component only for two purposes: making the native file
// input keyboard-accessible behind a real <button> (a <label> alone is
// not focusable/operable by keyboard), and echoing the selected file's
// name after a choice is made. Every other behavior — including the
// remove-toggle's dim/reveal states — stays pure CSS via the existing
// checkbox+sibling-selector pattern, so canceling the OS file picker can
// never affect the removeImage checkbox or the currently stored image.

import { useRef, useState } from "react";
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
  const removeCheckboxId = `${formId}-${removeFieldName}`;

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
          />
        ) : null}

        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-only preview; remote next/image configuration is deferred to the public-display slice
          <img src={imageUrl} alt={imageAlt} className="admin-image-preview-lg" />
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
            setSelectedFileName(file ? file.name : null);
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
