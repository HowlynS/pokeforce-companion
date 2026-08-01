export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/"
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://merchants-codex.invalid");
    if (
      parsed.origin !== "https://merchants-codex.invalid" ||
      parsed.pathname === "/login"
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function loginPathFor(returnTo: string | null | undefined): string {
  const safe = safeReturnPath(returnTo, "");
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
