import { describe, expect, it } from "vitest";
import {
  formatSaveShortcutLabel,
  isMacPlatform,
  saveShortcutAccessibleLabel,
} from "./save-shortcut";

describe("isMacPlatform", () => {
  it("recognizes common macOS platform strings", () => {
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("Mac68K")).toBe(true);
    expect(isMacPlatform("macOS")).toBe(true);
  });

  it("recognizes mobile Apple platform strings", () => {
    expect(isMacPlatform("iPhone")).toBe(true);
    expect(isMacPlatform("iPad")).toBe(true);
    expect(isMacPlatform("iPod")).toBe(true);
  });

  it("returns false for Windows and Linux platform strings", () => {
    expect(isMacPlatform("Win32")).toBe(false);
    expect(isMacPlatform("Windows")).toBe(false);
    expect(isMacPlatform("Linux x86_64")).toBe(false);
  });

  it("returns false for a missing platform value", () => {
    expect(isMacPlatform(null)).toBe(false);
    expect(isMacPlatform(undefined)).toBe(false);
    expect(isMacPlatform("")).toBe(false);
  });
});

describe("formatSaveShortcutLabel", () => {
  it("returns the Command glyph label on macOS platforms", () => {
    expect(formatSaveShortcutLabel("MacIntel")).toBe("⌘S");
  });

  it("returns the Ctrl+S label on Windows/Linux/unknown platforms", () => {
    expect(formatSaveShortcutLabel("Win32")).toBe("Ctrl+S");
    expect(formatSaveShortcutLabel("Linux x86_64")).toBe("Ctrl+S");
    expect(formatSaveShortcutLabel(undefined)).toBe("Ctrl+S");
  });
});

describe("saveShortcutAccessibleLabel", () => {
  it("spells out Command on macOS, never relying solely on the glyph", () => {
    expect(saveShortcutAccessibleLabel("MacIntel")).toBe(
      "Save shortcut: Command S"
    );
  });

  it("spells out Control on Windows/Linux/unknown", () => {
    expect(saveShortcutAccessibleLabel("Win32")).toBe(
      "Save shortcut: Control S"
    );
    expect(saveShortcutAccessibleLabel(undefined)).toBe(
      "Save shortcut: Control S"
    );
  });
});
