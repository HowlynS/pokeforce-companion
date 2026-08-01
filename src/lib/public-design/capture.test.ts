import { describe, expect, it } from "vitest";
import {
  PUBLIC_DESIGN_CAPTURE_MANIFEST_VERSION,
  buildPublicDesignCaptureMatrix,
  createPublicDesignCaptureManifest,
  getPublicDesignCaptureFilename,
  getPublicDesignCaptureOutputDirectory,
  parsePublicDesignCaptureArgs,
  type PublicDesignCaptureResult,
} from "@/lib/public-design/capture";
import { PUBLIC_DESIGN_CONTRACTS } from "@/lib/public-design/contracts";

describe("public design capture registry", () => {
  it("builds a unique matrix from every registered contract option", () => {
    const matrix = buildPublicDesignCaptureMatrix();
    expect(new Set(matrix.map(({ id }) => id)).size).toBe(matrix.length);
    expect(matrix.map(({ contractId }) => contractId)).toEqual(
      expect.arrayContaining(PUBLIC_DESIGN_CONTRACTS.map(({ id }) => id))
    );
    expect(matrix.every(({ route }) => route.startsWith("/"))).toBe(true);
    expect(matrix.every(({ route }) => !route.startsWith("/admin"))).toBe(true);
  });

  it("filters by contract, fixture, viewport, and family", () => {
    expect(
      buildPublicDesignCaptureMatrix({
        contract: "item-detail",
        fixture: "item-no-image",
        viewport: "mobile-390",
        family: "detail",
      })
    ).toEqual([
      expect.objectContaining({
        id: "item-detail:item-no-image:mobile-390",
        route: "/items/design-review-item-no-image-long-name",
        width: 390,
        height: 844,
      }),
    ]);
  });

  it("rejects unknown or incompatible filters before browser startup", () => {
    expect(() => buildPublicDesignCaptureMatrix({ contract: "unknown" })).toThrow(
      "Unknown public design contract"
    );
    expect(() =>
      buildPublicDesignCaptureMatrix({
        contract: "home",
        fixture: "item-dense",
      })
    ).toThrow("No public design captures match filters");
  });

  it("parses space and equals CLI options with a safe run ID", () => {
    expect(
      parsePublicDesignCaptureArgs(
        [
          "--contract=item-detail",
          "--fixture",
          "item-dense",
          "--viewport=desktop-1920",
          "--family",
          "detail",
          "--run-id=review-01",
        ],
        "unused"
      )
    ).toEqual({
      filters: {
        contract: "item-detail",
        fixture: "item-dense",
        viewport: "desktop-1920",
        family: "detail",
      },
      runId: "review-01",
      help: false,
    });
    expect(() =>
      parsePublicDesignCaptureArgs(["--run-id=../escape"], "unused")
    ).toThrow("Capture run ID");
  });

  it("uses deterministic filenames and summarizes manifest results", () => {
    expect(
      getPublicDesignCaptureFilename(
        "item-detail",
        "item-dense",
        "desktop-1920"
      )
    ).toBe("item-detail--item-dense--desktop-1920.png");
    expect(getPublicDesignCaptureOutputDirectory("review-01")).toBe(
      "test-results/public-design-review/review-01"
    );

    const matrixEntry = buildPublicDesignCaptureMatrix({
      contract: "home",
      viewport: "mobile-390",
    })[0];
    const result: PublicDesignCaptureResult = {
      ...matrixEntry,
      screenshotPath: matrixEntry.filename,
      capturedAt: "2026-08-01T12:00:00.000Z",
      status: 200,
      success: true,
      failure: null,
      pageErrors: [],
      consoleErrors: [],
      dimensions: {
        clientWidth: 390,
        scrollWidth: 390,
        clientHeight: 844,
        scrollHeight: 1200,
      },
      horizontalOverflow: false,
    };
    expect(
      createPublicDesignCaptureManifest(
        "review-01",
        { contract: "home" },
        [result],
        "2026-08-01T12:00:01.000Z"
      )
    ).toMatchObject({
      version: PUBLIC_DESIGN_CAPTURE_MANIFEST_VERSION,
      requested: 1,
      succeeded: 1,
      failed: 0,
      overflowCount: 0,
    });
  });
});
