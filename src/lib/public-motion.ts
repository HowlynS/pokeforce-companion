/**
 * Returns the handoff timing for public UI state transitions, or zero when
 * the visitor has requested reduced motion. Call only from browser events.
 */
export function publicMotionDuration(durationMs: number): number {
  if (typeof window === "undefined") return 0;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : durationMs;
}
