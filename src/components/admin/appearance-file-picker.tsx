"use client";

import { useState, type ChangeEventHandler, type RefObject } from "react";
import { Upload } from "lucide-react";

type AppearanceFilePickerProps = {
  id: string;
  name: string;
  accept: string;
  fileName: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  describedBy?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

export function AppearanceFilePicker({
  id,
  name,
  accept,
  fileName,
  inputRef,
  describedBy,
  onChange,
}: AppearanceFilePickerProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="appearance-file-picker"
      data-dragging={dragging ? "true" : undefined}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files.item(0);
        const input = inputRef.current;
        if (!file || !input) {
          return;
        }
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="appearance-file-native"
        aria-label="Choose replacement file"
        aria-describedby={describedBy}
        tabIndex={-1}
        onChange={onChange}
      />
      <button
        type="button"
        className="btn btn-primary btn-compact appearance-file-picker-button"
        aria-controls={id}
        onClick={() => inputRef.current?.click()}
      >
        <Upload aria-hidden="true" />
        Choose file
      </button>
      <span className="appearance-file-picker-name" aria-live="polite">
        {fileName ?? "No file selected"}
      </span>
    </div>
  );
}
