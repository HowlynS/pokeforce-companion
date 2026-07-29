"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Trash2, Upload } from "lucide-react";
import { dispatchFormChange } from "@/lib/admin/form-change-event";

export const APPEARANCE_RESTORE_DEFAULTS_EVENT =
  "pf:appearance-restore-defaults";
export const APPEARANCE_RESET_DRAFT_EVENT = "pf:appearance-reset-draft";
export const APPEARANCE_ASSET_DRAFT_EVENT = "pf:appearance-asset-draft";

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
  validation: "logo" | "favicon" | "wallpaper";
};

const CLIENT_VALIDATION = {
  logo: {
    maxBytes: 5 * 1024 * 1024,
    minWidth: 32,
    minHeight: 32,
    maxWidth: 4096,
    maxHeight: 4096,
    dimensionsMessage: "Logo dimensions must be between 32×32 and 4096×4096 pixels.",
  },
  favicon: {
    maxBytes: 1024 * 1024,
    minWidth: 16,
    minHeight: 16,
    maxWidth: 512,
    maxHeight: 512,
    dimensionsMessage: "Favicon dimensions must be between 16×16 and 512×512 pixels.",
  },
  wallpaper: {
    maxBytes: 5 * 1024 * 1024,
    minWidth: 640,
    minHeight: 360,
    maxWidth: 8192,
    maxHeight: 8192,
    dimensionsMessage: "Wallpaper dimensions must be between 640×360 and 8192×8192 pixels.",
  },
} as const;

function validateClientAsset(
  file: File,
  validation: AppearanceAssetFieldProps["validation"],
  dimensions?: { width: number; height: number }
): string | null {
  const rules = CLIENT_VALIDATION[validation];
  const acceptedTypes =
    validation === "favicon"
      ? new Set(["image/png", "image/x-icon", "image/vnd.microsoft.icon"])
      : new Set(["image/png", "image/jpeg", "image/webp"]);
  const isIco =
    validation === "favicon" && file.name.toLowerCase().endsWith(".ico");

  if (!acceptedTypes.has(file.type.toLowerCase()) && !isIco) {
    return `Choose a supported ${validation === "favicon" ? "PNG or ICO" : "PNG, JPEG, or WebP"} file.`;
  }
  if (file.size > rules.maxBytes) {
    return `The selected file exceeds the ${validation === "favicon" ? "1 MB" : "5 MB"} limit.`;
  }
  if (
    dimensions &&
    (dimensions.width < rules.minWidth ||
      dimensions.height < rules.minHeight ||
      dimensions.width > rules.maxWidth ||
      dimensions.height > rules.maxHeight)
  ) {
    return rules.dimensionsMessage;
  }
  return null;
}

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
  validation,
}: AppearanceAssetFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const intentRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  function notifyProgrammaticChange() {
    requestAnimationFrame(() => dispatchFormChange(intentRef.current));
  }

  function updateValidationError(message: string | null) {
    setValidationError(message);
    fileRef.current?.setCustomValidity(message ?? "");
  }

  function resetDraft() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFileName(null);
    setPreviewDimensions(null);
    setPendingRemoval(false);
    updateValidationError(null);
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
      updateValidationError(null);
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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_ASSET_DRAFT_EVENT, {
        detail: {
          name,
          url: draftUrl,
          width: previewDimensions?.width ?? currentWidth,
          height: previewDimensions?.height ?? currentHeight,
        },
      })
    );
  }, [
    currentHeight,
    currentWidth,
    draftUrl,
    name,
    previewDimensions?.height,
    previewDimensions?.width,
  ]);

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
              const dimensions = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              setPreviewDimensions(dimensions);
              const file = fileRef.current?.files?.[0];
              updateValidationError(
                file ? validateClientAsset(file, validation, dimensions) : null
              );
            }}
            onError={() => {
              if (previewUrl) {
                updateValidationError(
                  "The selected file could not be decoded as an image."
                );
              }
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
        aria-describedby={`${name}-help${validationError ? ` ${name}-error` : ""}`}
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
          updateValidationError(validateClientAsset(file, validation));
        }}
      />
      <p id={`${name}-help`} className="field-help">
        {helper}
      </p>
      {validationError ? (
        <p id={`${name}-error`} role="alert" className="appearance-field-error">
          {validationError}
        </p>
      ) : null}

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
  onError,
}: {
  url: string | null;
  alt: string;
  fit: "contain" | "cover";
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}) {
  return (
    <div className={`appearance-asset-preview appearance-asset-preview--${fit}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URLs and remote admin preview URLs are both intentional here.
        <img src={url} alt={alt} onLoad={onLoad} onError={onError} />
      ) : (
        <span>No asset published</span>
      )}
    </div>
  );
}
