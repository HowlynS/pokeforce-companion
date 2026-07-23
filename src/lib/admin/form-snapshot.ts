// Shared dirty-state snapshotting for admin editors (Opus Pass 2). Pure,
// DOM-free, and deterministic so it can be unit-tested in Node against a
// plain FormData, and reused by the client form guard against a real
// <form>'s live FormData. The whole point is a MEANINGFUL comparison:
// capture the form's baseline once, then compare a fresh snapshot against
// it — equal means clean (even after edit-then-revert), different means
// dirty — rather than a crude "any input event = permanently dirty" flag.
//
// Normalization rules are deliberately conservative and match the server
// parsers' own semantics as closely as is safe:
//   - Line endings are normalized (\r\n / \r -> \n) so a textarea that a
//     browser rewrites on submit never reads as a false change.
//   - Values are NOT trimmed. The server parsers trim some fields but not
//     all, and trimming here for comparison could hide a real change the
//     server would keep — a trailing space reading as "dirty" is the safe
//     direction (warn rather than silently lose).
//   - Unchecked checkboxes are simply absent from FormData, so checking
//     then unchecking returns to the exact baseline deterministically.
//   - Field ORDER across different names never matters (the snapshot is
//     keyed by name and canonicalized with sorted keys); repeated values
//     under ONE name keep their submission order (meaningful for e.g.
//     ingredient rows).
//   - File inputs are represented only as a presence marker (name + size +
//     lastModified) — never their bytes — so selecting a file reads as
//     dirty without the snapshot ever holding binary content. An untouched
//     file input submits a zero-byte, empty-name File and is treated as
//     absent.
//   - Technical/framework fields are excluded: any "$"-prefixed name
//     (Next.js server-action internals) plus caller-listed immutable
//     fields (record id, originalSlug, and any hidden value the visible UI
//     never edits).

export type FormSnapshot = Record<string, string[]>;

export type SnapshotOptions = {
  /** Field names to ignore entirely (record id, originalSlug, and any
      hidden field whose value the visible UI never changes). "$"-prefixed
      framework fields are always excluded regardless. */
  exclude?: readonly string[];
};

// Server-action and framework internals Next.js may inject into a form.
const TECHNICAL_FIELD_PREFIX = "$";

// Marks a file field's presence in a snapshot. Never restorable, never
// persisted to a draft — only ever used so "a file is selected" reads as
// different from "no file selected".
const FILE_MARKER_PREFIX = " file:";

type FileLike = { name: string; size: number; lastModified?: number };

function isFileLike(value: unknown): value is FileLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as FileLike).name === "string" &&
    typeof (value as FileLike).size === "number"
  );
}

/** Normalizes a string value for comparison: line endings only, never a
    trim (see the module comment for why trimming would be unsafe). */
export function normalizeSnapshotValue(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

type FormEntrySource =
  | FormData
  | Iterable<[string, FormDataEntryValue | FileLike | string]>;

function entriesOf(
  source: FormEntrySource
): Iterable<[string, FormDataEntryValue | FileLike | string]> {
  // FormData is iterable as [name, value]; a plain array of pairs is used
  // by the unit tests. Both are handled uniformly.
  return source as Iterable<[string, FormDataEntryValue | FileLike | string]>;
}

/** Builds a normalized, order-canonical snapshot from a form's entries. */
export function snapshotFormData(
  source: FormEntrySource,
  options: SnapshotOptions = {}
): FormSnapshot {
  const exclude = new Set(options.exclude ?? []);
  const snapshot: FormSnapshot = {};

  for (const [name, value] of entriesOf(source)) {
    if (name.startsWith(TECHNICAL_FIELD_PREFIX)) {
      continue;
    }
    if (exclude.has(name)) {
      continue;
    }

    let normalized: string;
    if (isFileLike(value)) {
      // An untouched file input submits an empty, zero-byte File — absent.
      if (value.size === 0 && value.name === "") {
        continue;
      }
      normalized = `${FILE_MARKER_PREFIX}${value.name}:${value.size}:${value.lastModified ?? ""}`;
    } else {
      normalized = normalizeSnapshotValue(String(value));
    }

    (snapshot[name] ??= []).push(normalized);
  }

  return snapshot;
}

/** A stable string form of a snapshot: keys sorted so field order can
    never create a false difference; values kept in submission order. */
export function canonicalizeSnapshot(snapshot: FormSnapshot): string {
  const keys = Object.keys(snapshot).sort();
  return JSON.stringify(keys.map((key) => [key, snapshot[key]]));
}

/** True when two snapshots represent the same meaningful form state. */
export function snapshotsEqual(a: FormSnapshot, b: FormSnapshot): boolean {
  return canonicalizeSnapshot(a) === canonicalizeSnapshot(b);
}

/** Whether a snapshot value is a (non-restorable) file-presence marker. */
export function isFileMarker(value: string): boolean {
  return value.startsWith(FILE_MARKER_PREFIX);
}

/** The subset of a snapshot that is safe and meaningful to persist to a
    draft: every string field, but never file-presence markers (a file
    cannot be serialized or restored). */
export function draftableValues(snapshot: FormSnapshot): FormSnapshot {
  const result: FormSnapshot = {};
  for (const [name, values] of Object.entries(snapshot)) {
    const restorable = values.filter((value) => !isFileMarker(value));
    if (restorable.length > 0) {
      result[name] = restorable;
    }
  }
  return result;
}
