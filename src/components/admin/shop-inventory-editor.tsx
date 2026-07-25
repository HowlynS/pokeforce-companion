"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { AdminSelect, type AdminSelectOption } from "@/components/admin/admin-select";
import {
  GameVersionVerificationControls,
  type GameVersionPickerOption,
} from "@/components/admin/game-version-verification-controls";
import { SearchableAdminSelect } from "@/components/admin/searchable-admin-select";
import { dispatchFormChange } from "@/lib/admin/form-change-event";
import { formatDisplayDate } from "@/lib/format-date";
import { MAX_SUBMITTED_SHOP_INVENTORY_ROWS } from "@/lib/validation/shop-listing";

const NEW_ROW_SLOT_COUNT = 20;

export type ShopInventoryListing = {
  id: string;
  itemId: string;
  itemName: string;
  currencyId: string;
  priceAmount: number;
  notes: string | null;
  verifiedAt: string | null;
  verifiedGameVersion: { name: string } | null;
};

type InventoryRow = {
  key: string;
  listingId: string | null;
  initial: ShopInventoryListing | null;
  existing: boolean;
};

type ShopInventoryEditorProps = {
  action: (formData: FormData) => void | Promise<void>;
  shopId: string;
  shopSlug: string;
  query: string;
  cancelHref: string;
  serverUpdatedAt: string;
  listings: ShopInventoryListing[];
  itemOptions: readonly AdminSelectOption[];
  currencyOptions: readonly AdminSelectOption[];
  gameVersions: GameVersionPickerOption[];
};

function activeInputName(key: string): string {
  return `${key}.active`;
}

export function ShopInventoryEditor({
  action,
  shopId,
  shopSlug,
  query,
  cancelHref,
  serverUpdatedAt,
  listings,
  itemOptions,
  currencyOptions,
  gameVersions,
}: ShopInventoryEditorProps) {
  const rows = useMemo<InventoryRow[]>(
    () => [
      ...listings.map((listing) => ({
        key: `existing-${listing.id}`,
        listingId: listing.id,
        initial: listing,
        existing: true,
      })),
      ...Array.from(
        {
          length: Math.min(
            NEW_ROW_SLOT_COUNT,
            Math.max(0, MAX_SUBMITTED_SHOP_INVENTORY_ROWS - listings.length)
          ),
        },
        (_, index) => ({
          key: `new-${index + 1}`,
          listingId: null,
          initial: null,
          existing: false,
        })
      ),
    ],
    [listings]
  );

  const [activeKeys, setActiveKeys] = useState(
    () => new Set(listings.map((listing) => `existing-${listing.id}`))
  );
  const [usedNewKeys, setUsedNewKeys] = useState<Set<string>>(() => new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const mountedRef = useRef(false);

  // Add/remove and draft restoration change controlled hidden fields rather
  // than native inputs. Notify AdminFormGuard after React has committed the
  // new row state so its snapshot sees the exact submitted values.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    dispatchFormChange(formRef.current);
  }, [activeKeys]);

  const activeCount = activeKeys.size;
  const nextUnusedRow = rows.find(
    (row) => !row.existing && !usedNewKeys.has(row.key)
  );
  const excludeFields = [
    "shopId",
    "shopSlug",
    "q",
    "listingRowKey",
    ...rows.flatMap((row) => [
      `${row.key}.listingId`,
      `${row.key}.verifiedGameVersionId`,
    ]),
  ];

  function setRowActive(key: string, active: boolean) {
    setActiveKeys((current) => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
    if (key.startsWith("new-")) {
      setUsedNewKeys((current) => new Set(current).add(key));
    }
  }

  function addRow() {
    if (!nextUnusedRow) {
      return;
    }
    setRowActive(nextUnusedRow.key, true);
    requestAnimationFrame(() => {
      document.getElementById(`${nextUnusedRow.key}-item`)?.focus();
    });
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="form-grid form-grid-wide form-grid-responsive shop-inventory-form"
    >
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="shopSlug" value={shopSlug} />
      <input type="hidden" name="q" value={query} />

      <div className="shop-inventory-toolbar">
        <div>
          <h2>Inventory listings</h2>
          <p className="text-muted">
            {activeCount} {activeCount === 1 ? "listing" : "listings"} staged
            for save
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addRow}
          disabled={!nextUnusedRow}
        >
          <Plus aria-hidden="true" size={16} />
          Add listing
        </button>
      </div>

      {rows.map((row, index) => {
        const active = activeKeys.has(row.key);
        const visible =
          row.existing || active || (row.key.startsWith("new-") && usedNewKeys.has(row.key));
        const pendingRemoval = visible && !active;
        const label =
          row.initial?.itemName ??
          `New listing ${Math.max(1, index - listings.length + 1)}`;

        const headingId = `${row.key}-heading`;

        return (
          <section
            key={row.key}
            className={
              "shop-inventory-row" +
              (pendingRemoval ? " shop-inventory-row--removed" : "")
            }
            aria-labelledby={headingId}
            hidden={!visible}
          >
            <input type="hidden" name="listingRowKey" value={row.key} />
            <input
              type="hidden"
              name={`${row.key}.listingId`}
              value={row.listingId ?? ""}
            />
            <input
              type="text"
              name={activeInputName(row.key)}
              value={active ? "1" : "0"}
              aria-hidden="true"
              tabIndex={-1}
              className="admin-select-proxy"
              onChange={(event) => {
                const restoredActive = event.target.value === "1";
                setRowActive(row.key, restoredActive);
              }}
            />

            <h3 id={headingId} className="shop-inventory-row-title">
              {label}
            </h3>

            {pendingRemoval ? (
              <div className="shop-inventory-removal-state" role="status">
                <span>Pending removal — save to delete this listing.</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRowActive(row.key, true)}
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  Undo removal
                </button>
              </div>
            ) : null}

            <div className="shop-inventory-row-fields">
              <label className="form-field">
                <span className="form-field-label">Item</span>
                <SearchableAdminSelect
                  id={`${row.key}-item`}
                  name={`${row.key}.itemId`}
                  defaultValue={row.initial?.itemId ?? ""}
                  placeholder="Select an item"
                  searchPlaceholder="Search items…"
                  noResultsLabel="No items match your search."
                  options={itemOptions}
                  required={active}
                  disabled={!active}
                />
              </label>

              <label className="form-field">
                <span className="form-field-label">Currency</span>
                <AdminSelect
                  name={`${row.key}.currencyId`}
                  defaultValue={row.initial?.currencyId ?? ""}
                  placeholder="Select a currency"
                  options={currencyOptions}
                  required={active}
                  disabled={!active}
                />
              </label>

              <label className="form-field">
                <span className="form-field-label">Price amount</span>
                <input
                  type="number"
                  name={`${row.key}.priceAmount`}
                  min={1}
                  max={2_147_483_647}
                  step={1}
                  required={active}
                  disabled={!active}
                  defaultValue={row.initial?.priceAmount ?? ""}
                  className="form-input"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="form-field">
              <span className="form-field-label">Notes (optional)</span>
              <textarea
                name={`${row.key}.notes`}
                rows={2}
                disabled={!active}
                defaultValue={row.initial?.notes ?? ""}
                className="form-input"
                placeholder="Optional context only — not stock or schedule data."
              />
            </label>

            <div className="shop-inventory-row-footer">
              <div className="shop-inventory-verification">
                <p className="form-field-label">Listing verification</p>
                <p className="text-muted">
                  {row.initial?.verifiedAt &&
                  row.initial.verifiedGameVersion ? (
                    <>
                      Verified for {row.initial.verifiedGameVersion.name} on{" "}
                      {formatDisplayDate(row.initial.verifiedAt)}
                    </>
                  ) : (
                    "Unverified"
                  )}
                </p>
                <GameVersionVerificationControls
                  gameVersions={gameVersions}
                  fieldPrefix={`${row.key}.`}
                  recordNoun="listing"
                  disabled={!active}
                />
              </div>

              {!pendingRemoval ? (
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => setRowActive(row.key, false)}
                  aria-label={`Remove ${label}`}
                >
                  <Trash2 aria-hidden="true" size={15} />
                  Remove
                </button>
              ) : null}
            </div>
          </section>
        );
      })}

      {activeCount === 0 ? (
        <div className="empty-state">
          <h3>No inventory listings yet</h3>
          <p>Add a listing to record what this Shop sells.</p>
        </div>
      ) : null}

      {!nextUnusedRow ? (
        <p className="text-muted">
          Save these staged rows before adding more listings.
        </p>
      ) : null}

      <AdminFormGuard
        submitLabel="Save Inventory"
        cancelHref={cancelHref}
        excludeFields={excludeFields}
        draftKey={`shop:edit:${shopId}:shop-inventory-form`}
        serverUpdatedAt={serverUpdatedAt}
      />
    </form>
  );
}
