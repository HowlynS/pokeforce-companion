/**
 * Shared public copy for Shop inventory summaries.
 */
export function formatInventoryListingCount(count: number): string {
  return `${count} inventory ${count === 1 ? "listing" : "listings"}`;
}
