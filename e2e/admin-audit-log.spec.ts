import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { loadTestEnvironment } from "../src/lib/testing/load-test-environment";

loadTestEnvironment();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const ACTION = "test.audit.pagination";
const IDS = Array.from({ length: 27 }, (_, index) =>
  `test-audit-pagination-${String(index + 1).padStart(2, "0")}`
);

async function cleanup() {
  await pool.query(`DELETE FROM "AuditEvent" WHERE "id" = ANY($1::text[])`, [
    IDS,
  ]);
}

test.beforeAll(async () => {
  await cleanup();
  for (const [index, id] of IDS.entries()) {
    await pool.query(
      `INSERT INTO "AuditEvent"
       ("id", "actorEmailSnapshot", "action", "targetType", "targetId", "targetLabelSnapshot", "metadata", "createdAt")
       VALUES ($1, 'system', $2, 'TEST_TARGET', $3, $4, $5::jsonb, $6)`,
      [
        id,
        ACTION,
        id,
        `Audit pagination ${String(index + 1).padStart(2, "0")}`,
        JSON.stringify({ sequence: index + 1 }),
        new Date(Date.UTC(2026, 7, 1, 12, index)),
      ]
    );
  }
});

test.afterAll(async () => {
  await cleanup();
  await pool.end();
});

test("Audit log filters and paginates bounded readable events", async ({ page }) => {
  await page.goto(`/admin/audit-log?action=${encodeURIComponent(ACTION)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByText("test · audit · pagination").first()).toBeVisible();

  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/action=test(?:%2E|\.)audit(?:%2E|\.)pagination.*page=2|page=2.*action=test/);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();

  await page.goto("/admin/audit-log?q=Audit%20pagination%2007");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByText("Show changed fields").click();
  await expect(page.getByText("sequence")).toBeVisible();
  await expect(page.getByText("7", { exact: true })).toBeVisible();
});
