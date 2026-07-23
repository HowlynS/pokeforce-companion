// Recoverable local drafts for admin editors (Opus Pass 2). A draft is a
// small JSON record of the meaningful editable field values, stored in
// sessionStorage (tab-scoped, so it never lingers indefinitely across
// unrelated future sessions) under a key that is deterministic and
// isolated by resource + route + record identity — one Item's draft can
// never restore into another Item, and an edit draft can never restore
// into a create form.
//
// Only restorable string field values are stored — never passwords, auth
// tokens, cookies, framework internals, file bytes, or a selected file
// (a file marker is stripped before persisting; see form-snapshot's
// draftableValues). The stored metadata (schema version, key, timestamps,
// and the server record's updatedAt at load time) is what lets the guard
// safely decide whether a draft is current, was already submitted, or is
// stale relative to a server record that changed underneath it.
//
// Every read is defensive: malformed, wrong-schema, or wrong-key JSON is
// treated as "no draft" and removed, never thrown.

import type { FormSnapshot } from "@/lib/admin/form-snapshot";

export const ADMIN_DRAFT_SCHEMA_VERSION = 1;

const STORAGE_PREFIX = "pf-admin-draft:";

export type AdminDraft = {
  schema: number;
  /** The draft's own isolation key (resource:mode:recordId:formId). */
  key: string;
  /** When the draft was last written (Date.now()). */
  savedAt: number;
  /** Set when the draft was flushed as part of a submit attempt — lets a
      later load distinguish "this was already submitted" from "editing was
      interrupted". */
  submittedAt?: number;
  /** The server record's updatedAt (ISO) at the time the form loaded —
      used to detect that the underlying record changed since the draft
      (e.g. a successful save, or a concurrent external edit). Absent for
      create forms. */
  serverUpdatedAt?: string | null;
  /** RecordSlugField's sync mode (auto/manual) at the time the draft was
      written — deliberately NOT part of `values` (see
      slug-restore-event.ts): it is restoration metadata, not meaningful
      editable data, so it must never affect the dirty comparison. Absent
      when the form has no RecordSlugField. */
  slugSyncMode?: "auto" | "manual";
  /** The restorable field values (no file markers). */
  values: FormSnapshot;
};

export type DraftContext = {
  key: string;
  serverUpdatedAt?: string | null;
};

/** Builds the storage key for a draft context. */
export function draftStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

/** Creates an in-memory draft record (does not persist it). */
export function createDraft(
  context: DraftContext,
  values: FormSnapshot,
  extra: { submittedAt?: number; slugSyncMode?: "auto" | "manual" } = {}
): AdminDraft {
  return {
    schema: ADMIN_DRAFT_SCHEMA_VERSION,
    key: context.key,
    savedAt: Date.now(),
    serverUpdatedAt: context.serverUpdatedAt ?? null,
    ...(extra.submittedAt ? { submittedAt: extra.submittedAt } : {}),
    ...(extra.slugSyncMode ? { slugSyncMode: extra.slugSyncMode } : {}),
    values,
  };
}

/** Serializes a draft for storage. */
export function serializeDraft(draft: AdminDraft): string {
  return JSON.stringify(draft);
}

function isValidValues(values: unknown): values is FormSnapshot {
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return false;
  }
  return Object.values(values as Record<string, unknown>).every(
    (entry) =>
      Array.isArray(entry) && entry.every((item) => typeof item === "string")
  );
}

/** Parses stored JSON into a draft, returning null for anything malformed,
    the wrong schema, or a key that does not match the expected one. Never
    throws. */
export function parseDraft(
  json: string | null | undefined,
  expectedKey: string
): AdminDraft | null {
  if (!json) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Partial<AdminDraft>;
  if (candidate.schema !== ADMIN_DRAFT_SCHEMA_VERSION) {
    return null;
  }
  if (candidate.key !== expectedKey) {
    return null;
  }
  if (typeof candidate.savedAt !== "number") {
    return null;
  }
  if (!isValidValues(candidate.values)) {
    return null;
  }

  return {
    schema: candidate.schema,
    key: candidate.key,
    savedAt: candidate.savedAt,
    submittedAt:
      typeof candidate.submittedAt === "number"
        ? candidate.submittedAt
        : undefined,
    serverUpdatedAt:
      typeof candidate.serverUpdatedAt === "string"
        ? candidate.serverUpdatedAt
        : null,
    ...(candidate.slugSyncMode === "auto" || candidate.slugSyncMode === "manual"
      ? { slugSyncMode: candidate.slugSyncMode }
      : {}),
    values: candidate.values,
  };
}

function sessionStore(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return null;
    }
    return window.sessionStorage;
  } catch {
    // Storage access can throw (privacy modes, disabled storage).
    return null;
  }
}

/** Reads and validates a stored draft; malformed data is removed and
    reported as absent. */
export function readDraft(key: string): AdminDraft | null {
  const store = sessionStore();
  if (!store) {
    return null;
  }
  const storageKey = draftStorageKey(key);
  const raw = store.getItem(storageKey);
  const draft = parseDraft(raw, key);
  if (raw && !draft) {
    // Malformed / stale-schema / mismatched — clear it so it can never be
    // retried or misread.
    try {
      store.removeItem(storageKey);
    } catch {
      // ignore
    }
  }
  return draft;
}

/** Persists a draft. */
export function writeDraft(draft: AdminDraft): void {
  const store = sessionStore();
  if (!store) {
    return;
  }
  try {
    store.setItem(draftStorageKey(draft.key), serializeDraft(draft));
  } catch {
    // Quota or privacy-mode failures must never break editing.
  }
}

/** Removes a stored draft. */
export function removeDraft(key: string): void {
  const store = sessionStore();
  if (!store) {
    return;
  }
  try {
    store.removeItem(draftStorageKey(key));
  } catch {
    // ignore
  }
}
