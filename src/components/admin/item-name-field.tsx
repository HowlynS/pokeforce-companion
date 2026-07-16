"use client";

// Live duplicate-name feedback for the Item create/edit forms. Since Slice
// 6E this is a thin wrapper around the generalized RecordNameField (which
// carries the debounce, stale-response, and accessibility behavior for
// every resource) — the rendered markup, the live-region id, and every
// message are identical to the original Item implementation, so the Item
// pages and tests are unaffected.

import { checkItemNameAvailability } from "@/app/admin/items/name-availability";
import { RecordNameField } from "./record-name-field";

type ItemNameFieldProps = {
  // Edit-only: the record's saved name (treated as "current", never queried)
  // and its id (excluded server-side so the record cannot conflict with
  // itself).
  originalName?: string;
  excludeId?: string;
};

export function ItemNameField({ originalName, excludeId }: ItemNameFieldProps) {
  return (
    <RecordNameField
      checkAvailabilityAction={checkItemNameAvailability}
      takenText="An item with that name already exists."
      regionId="item-name-availability"
      originalName={originalName}
      excludeId={excludeId}
    />
  );
}
