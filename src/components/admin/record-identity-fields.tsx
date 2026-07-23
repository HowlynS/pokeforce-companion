"use client";

// Shared Name + Page address field pair for every slug-based admin
// resource (Phase B1, System B) — one controller, not five diverging
// per-resource state machines. Owns the single piece of state the two
// fields must share (the live Name value) and renders RecordNameField
// (unchanged — Slice 6E's own duplicate-name feedback) beside the new
// RecordSlugField (auto-generation, manual-override tracking, and its own
// duplicate-slug feedback), wired together via RecordNameField's
// `onNameChange` prop. Both fields still submit as plain `name="name"`/
// `name="slug"` form fields — this component adds no client-side
// mutation, only live preview/feedback, exactly like RecordNameField
// always has.

import { useState } from "react";
import { RecordNameField } from "@/components/admin/record-name-field";
import { RecordSlugField } from "@/components/admin/record-slug-field";
import type { RecordNameAvailability } from "@/lib/admin/record-name";
import type { RecordSlugAvailability } from "@/lib/admin/record-slug";

type RecordIdentityFieldsProps = {
  checkNameAvailabilityAction: (
    rawName: string,
    rawExcludeId?: string
  ) => Promise<RecordNameAvailability>;
  nameTakenText: string;
  nameRegionId: string;
  checkSlugAvailabilityAction: (
    rawSlug: string,
    rawExcludeId?: string
  ) => Promise<RecordSlugAvailability>;
  slugTakenText: string;
  slugRegionId: string;
  /** Edit-only: the record's saved name/slug (each treated as "current",
      never queried against itself) and its id (excluded server-side). */
  originalName?: string;
  initialSlug?: string;
  excludeId?: string;
};

export function RecordIdentityFields({
  checkNameAvailabilityAction,
  nameTakenText,
  nameRegionId,
  checkSlugAvailabilityAction,
  slugTakenText,
  slugRegionId,
  originalName,
  initialSlug,
  excludeId,
}: RecordIdentityFieldsProps) {
  const [name, setName] = useState(originalName ?? "");

  return (
    <>
      <RecordNameField
        checkAvailabilityAction={checkNameAvailabilityAction}
        takenText={nameTakenText}
        regionId={nameRegionId}
        originalName={originalName}
        excludeId={excludeId}
        onNameChange={setName}
      />
      <RecordSlugField
        nameValue={name}
        initialSlug={initialSlug}
        excludeId={excludeId}
        checkAvailabilityAction={checkSlugAvailabilityAction}
        takenText={slugTakenText}
        regionId={slugRegionId}
      />
    </>
  );
}
