"use client";

import { useEffect, useRef, useState } from "react";
import { AdminSelect, type AdminSelectOption } from "@/components/admin/admin-select";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import {
  ACQUISITION_TYPE_LABELS,
  CREATABLE_ACQUISITION_TYPES,
} from "@/lib/validation/acquisition-source";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import { readDraft } from "@/lib/admin/form-draft";

type SourceRow = {
  key: number;
  type?: string;
  locationId?: string;
  professionId?: string;
  sourceLabel?: string;
  quantity?: string;
  notes?: string;
};

type ItemCreateSourcesProps = {
  locationOptions: readonly AdminSelectOption[];
  professionOptions: readonly AdminSelectOption[];
  draftKey: string;
  serverError?: string;
};

export function ItemCreateSources({
  locationOptions,
  professionOptions,
  draftKey,
  serverError,
}: ItemCreateSourcesProps) {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<SourceRow[]>([]);

  useEffect(() => {
    const values = readDraft(draftKey)?.values;
    const rowIds = Array.from(
      new Set(
        values?.acquisitionSourceRowIds?.[0]
          ?.split(",")
          .filter((value) => /^\d+$/.test(value)) ?? []
      )
    );
    if (!rowIds?.length) return;
    const restored = rowIds.map((id) => ({
      key: Number(id),
      type: values?.[`sourceType${id}`]?.[0] ?? "",
      locationId: values?.[`sourceLocationId${id}`]?.[0] ?? "",
      professionId: values?.[`sourceProfessionId${id}`]?.[0] ?? "",
      sourceLabel: values?.[`sourceLabel${id}`]?.[0] ?? "",
      quantity: values?.[`sourceQuantity${id}`]?.[0] ?? "",
      notes: values?.[`sourceNotes${id}`]?.[0] ?? "",
    }));
    const restoreTimer = window.setTimeout(() => {
      nextKey.current = Math.max(...restored.map((row) => row.key)) + 1;
      setRows(restored);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [draftKey]);

  function changed() {
    requestAnimationFrame(() => {
      const form = document.querySelector<HTMLInputElement>(
        'input[name="acquisitionSourceRowIds"]'
      )?.form;
      dispatchFormChange(form);
    });
  }

  function addSource() {
    setRows((current) => [...current, { key: nextKey.current++ }]);
    changed();
  }

  function removeSource(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
    changed();
  }

  const validTypes = new Set<string>(CREATABLE_ACQUISITION_TYPES);
  const validLocations = new Set(locationOptions.map((option) => option.value));
  const validProfessions = new Set(
    professionOptions.map((option) => option.value)
  );
  const invalidRowKey =
    serverError === "source_missing_type"
      ? rows.find((row) => !row.type)?.key
      : serverError === "source_invalid_type"
        ? rows.find((row) => !row.type || !validTypes.has(row.type))?.key
        : serverError === "source_invalid_location"
          ? rows.find(
              (row) =>
                Boolean(row.locationId) &&
                !validLocations.has(row.locationId ?? "")
            )?.key
          : serverError === "source_invalid_profession"
            ? rows.find(
                (row) =>
                  Boolean(row.professionId) &&
                  !validProfessions.has(row.professionId ?? "")
              )?.key
            : undefined;

  return (
    <div className="item-create-sources">
      <input
        type="hidden"
        name="acquisitionSourceRowIds"
        value={rows.map((row) => row.key).join(",")}
      />
      {rows.map((row, index) => (
        <section className="item-create-source-card" key={row.key}>
          <div className="item-create-source-heading">
            <strong>Acquisition source {index + 1}</strong>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => removeSource(row.key)}
            >
              Remove
            </button>
          </div>
          <div className="form-grid form-grid-responsive">
            <div className="form-field">
              <label
                className="form-field-label"
                htmlFor={`source-type-${row.key}`}
              >
                Type
              </label>
              <AdminSelect
                id={`source-type-${row.key}`}
                name={`sourceType${row.key}`}
                required
                defaultValue={row.type ?? ""}
                placeholder="Select a type"
                className={
                  (serverError === "source_missing_type" ||
                    serverError === "source_invalid_type") &&
                  row.key === invalidRowKey
                    ? "field-invalid"
                    : undefined
                }
                ariaInvalid={
                  (serverError === "source_missing_type" ||
                    serverError === "source_invalid_type") &&
                  row.key === invalidRowKey
                }
                ariaDescribedBy={
                  (serverError === "source_missing_type" ||
                    serverError === "source_invalid_type") &&
                  row.key === invalidRowKey
                    ? `source-type-${row.key}-error`
                    : undefined
                }
                autoFocus={
                  (serverError === "source_missing_type" ||
                    serverError === "source_invalid_type") &&
                  row.key === invalidRowKey
                }
                options={CREATABLE_ACQUISITION_TYPES.map((type) => ({
                  value: type,
                  label: ACQUISITION_TYPE_LABELS[type],
                }))}
              />
              {(serverError === "source_missing_type" ||
                serverError === "source_invalid_type") &&
              row.key === invalidRowKey ? (
                <span
                  id={`source-type-${row.key}-error`}
                  className="form-field-feedback text-danger"
                >
                  {serverError === "source_invalid_type"
                    ? "Select a valid Acquisition Source type."
                    : "Select a type for every Acquisition Source."}
                </span>
              ) : null}
            </div>
            <div className="form-field">
              <label
                className="form-field-label"
                htmlFor={`source-location-${row.key}`}
              >
                Location (optional)
              </label>
              <AdminSelect
                id={`source-location-${row.key}`}
                name={`sourceLocationId${row.key}`}
                defaultValue={row.locationId ?? ""}
                ariaInvalid={
                  serverError === "source_invalid_location" &&
                  row.key === invalidRowKey
                }
                ariaDescribedBy={
                  serverError === "source_invalid_location" &&
                  row.key === invalidRowKey
                    ? `source-location-${row.key}-error`
                    : undefined
                }
                autoFocus={
                  serverError === "source_invalid_location" &&
                  row.key === invalidRowKey
                }
                options={[
                  { value: "", label: "No location", imageUrl: null },
                  ...locationOptions,
                ]}
              />
              {serverError === "source_invalid_location" &&
              row.key === invalidRowKey ? (
                <span
                  id={`source-location-${row.key}-error`}
                  className="form-field-feedback text-danger"
                >
                  Select an existing Location.
                </span>
              ) : null}
            </div>
            <div className="form-field">
              <label
                className="form-field-label"
                htmlFor={`source-profession-${row.key}`}
              >
                Profession (optional)
              </label>
              <AdminSelect
                id={`source-profession-${row.key}`}
                name={`sourceProfessionId${row.key}`}
                defaultValue={row.professionId ?? ""}
                ariaInvalid={
                  serverError === "source_invalid_profession" &&
                  row.key === invalidRowKey
                }
                ariaDescribedBy={
                  serverError === "source_invalid_profession" &&
                  row.key === invalidRowKey
                    ? `source-profession-${row.key}-error`
                    : undefined
                }
                autoFocus={
                  serverError === "source_invalid_profession" &&
                  row.key === invalidRowKey
                }
                options={[
                  { value: "", label: "No profession", imageUrl: null },
                  ...professionOptions,
                ]}
              />
              {serverError === "source_invalid_profession" &&
              row.key === invalidRowKey ? (
                <span
                  id={`source-profession-${row.key}-error`}
                  className="form-field-feedback text-danger"
                >
                  Select an existing Profession.
                </span>
              ) : null}
            </div>
            <label className="form-field">
              <span className="form-field-label">Source label (optional)</span>
              <input
                name={`sourceLabel${row.key}`}
                type="text"
                className="form-input"
                defaultValue={row.sourceLabel}
              />
            </label>
            <label className="form-field">
              <span className="form-field-label">Quantity (optional)</span>
              <input
                name={`sourceQuantity${row.key}`}
                type="text"
                className="form-input"
                defaultValue={row.quantity}
              />
            </label>
            <label className="form-field admin-editor-section--full">
              <span className="form-field-label">Notes (optional)</span>
              <AutosizeTextarea
                name={`sourceNotes${row.key}`}
                className="form-input"
                defaultValue={row.notes}
              />
            </label>
          </div>
        </section>
      ))}
      <button
        type="button"
        className="button button-secondary"
        onClick={addSource}
      >
        + Acquisition source
      </button>
    </div>
  );
}
