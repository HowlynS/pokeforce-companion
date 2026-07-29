"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Trash2, Upload } from "lucide-react";
import { dispatchFormChange } from "@/lib/admin/form-change-event";

export const APPEARANCE_RESTORE_DEFAULTS_EVENT =
  "pf:appearance-restore-defaults";
export const APPEARANCE_RESET_DRAFT_EVENT = "pf:appearance-reset-draft";

type AppearanceAssetFieldProps = {
  name: string;
  label: string;
  description: string;
  currentUrl: string | null;
  currentWidth: number | null;
  currentHeight: number | null;
  custom: boolean;
  defaultUrl: string | null;
  accept: string;
  helper: string;
  fit?: "contain" | "cover";
};

export function AppearanceAssetField({
  name,
  label,
  description,
  currentUrl,
  currentWidth,
  currentHeight,
  custom,
  defaultUrl,
  accept,
  helper,
  fit = "contain",
}: AppearanceAssetFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const intentRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  function notifyProgrammaticChange() {
    requestAnimationFrame(() => dispatchFormChange(intentRef.current));
  }

  function resetDraft() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFileName(null);
    setPreviewDimensions(null);
    setPendingRemoval(false);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    notifyProgrammaticChange();
  }

  useEffect(() => {
    const restoreDefaults = () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setFileName(null);
      setPreviewDimensions(null);
      setPendingRemoval(custom);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      notifyProgrammaticChange();
    };
    const reset = () => resetDraft();
    window.addEventListener(APPEARANCE_RESTORE_DEFAULTS_EVENT, restoreDefaults);
    window.addEventListener(APPEARANCE_RESET_DRAFT_EVENT, reset);
    return () => {
      window.removeEventListener(
        APPEARANCE_RESTORE_DEFAULTS_EVENT,
        restoreDefaults
      );
      window.removeEventListener(APPEARANCE_RESET_DRAFT_EVENT, reset);
    };
    // The listeners must always act on this field's current object URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom, previewUrl]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl]
  );

  const draftUrl = previewUrl ?? (pendingRemoval ? defaultUrl : currentUrl);
  const hasPendingChange = Boolean(previewUrl || pendingRemoval);
  const status = previewUrl
    ? "Pending replacement"
    : pendingRemoval
      ? "Pending removal · committed default will publish"
      : custom
        ? "Custom asset published"
        : "Committed default published";

  return (
    <fieldset className="appearance-asset-field">
      <legend className="appearance-asset-title">{label}</legend>
      <p className="appearance-asset-description">{description}</p>

      <input
        ref={intentRef}
        type="hidden"
        name={`${name}Intent`}
        value={pendingRemoval ? "remove" : "keep"}
      />

      <div className="appearance-asset-comparison">
        <div className="appearance-asset-state">
          <span className="appearance-asset-state-label">Published</span>
          <AssetPreview
            url={currentUrl}
            alt={`Currently published ${label.toLowerCase()}`}
            fit={fit}
          />
        </div>

        <div
          className={
            hasPendingChange
              ? "appearance-asset-state appearance-asset-state--pending"
              : "appearance-asset-state"
          }
        >
          <span className="appearance-asset-state-label">Draft</span>
          <AssetPreview
            url={draftUrl}
            alt={`Draft ${label.toLowerCase()} preview`}
            fit={fit}
            onLoad={(event) => {
              if (!previewUrl) {
                return;
              }
              setPreviewDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
          />
        </div>
      </div>

      <div className="appearance-asset-meta">
        <span className={hasPendingChange ? "appearance-pending-label" : undefined}>
          {status}
        </span>
        <span>
          {previewDimensions
            ? `${previewDimensions.width}×${previewDimensions.height}px`
            : currentWidth && currentHeight
              ? `${currentWidth}×${currentHeight}px`
              : "Intrinsic dimensions unavailable"}
        </span>
      </div>

      <label className="field-label" htmlFor={`${name}-file`}>
        Replacement file
      </label>
      <input
        ref={fileRef}
        id={`${name}-file`}
        name={`${name}File`}
        type="file"
        accept={accept}
        className="appearance-file-input"
        aria-describedby={`${name}-help`}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) {
            return;
          }
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(URL.createObjectURL(file));
          setFileName(file.name);
          setPendingRemoval(false);
          setPreviewDimensions(null);
        }}
      />
      <p id={`${name}-help`} className="field-help">
        {helper}
      </p>

      <div className="appearance-asset-actions">
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={() => fileRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          {custom ? "Replace" : "Upload custom"}
        </button>

        {custom && !previewUrl ? (
          <button
            type="button"
            className="btn btn-danger-outline btn-compact"
            onClick={() => {
              setPendingRemoval((value) => !value);
              notifyProgrammaticChange();
            }}
          >
            <Trash2 aria-hidden="true" />
            {pendingRemoval ? "Keep custom" : "Remove custom"}
          </button>
        ) : null}

        {hasPendingChange ? (
          <button
            type="button"
            className="btn btn-cancel btn-compact"
            onClick={resetDraft}
          >
            <RotateCcw aria-hidden="true" />
            Reset asset
          </button>
        ) : null}
      </div>

      {fileName ? (
        <p className="appearance-file-name">Selected: {fileName}</p>
      ) : null}
    </fieldset>
  );
}

function AssetPreview({
  url,
  alt,
  fit,
  onLoad,
}: {
  url: string | null;
  alt: string;
  fit: "contain" | "cover";
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
}) {
  return (
    <div className={`appearance-asset-preview appearance-asset-preview--${fit}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URLs and remote admin preview URLs are both intentional here.
        <img src={url} alt={alt} onLoad={onLoad} />
      ) : (
        <span>No asset published</span>
      )}
    </div>
  );
}
