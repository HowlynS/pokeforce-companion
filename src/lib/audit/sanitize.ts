const FORBIDDEN_KEY = /(password|passphrase|token|cookie|secret|service.?role|api.?key|signed.?url|raw.?file|bytes|rich.?text|descriptionRich)/i;
const MAX_STRING_LENGTH = 240;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 4;

export type SanitizedAuditValue =
  | string
  | number
  | boolean
  | null
  | SanitizedAuditValue[]
  | { [key: string]: SanitizedAuditValue };

function sanitizeValue(value: unknown, depth: number): SanitizedAuditValue {
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, SanitizedAuditValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!FORBIDDEN_KEY.test(key) && entry !== undefined) {
        result[key] = sanitizeValue(entry, depth + 1);
      }
    }
    return result;
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, SanitizedAuditValue> | null {
  if (!metadata) return null;
  return sanitizeValue(metadata, 0) as Record<string, SanitizedAuditValue>;
}
