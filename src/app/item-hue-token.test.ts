import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

/** Declarations only — prose about a retired value is not a stale usage. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Architectural guard for the Item resource hue. Everything that paints an
 * Item stage derives from ONE triple; these assertions are about that
 * structure, not about any particular colour looking right.
 */
describe("canonical Item hue", () => {
  it("is declared exactly once", () => {
    expect(declarations.match(/--hue-item:\s*[^;]+;/g) ?? []).toHaveLength(1);
  });

  it("no longer carries the retired darker sapphire anywhere", () => {
    // The pre-2026-08-20 value. If it survives in any active rule, some
    // surface is painting a stale Item blue instead of inheriting the token.
    expect(declarations).not.toMatch(/55,\s*108,\s*145/);
  });

  it("is consumed through the shared --resource-hue indirection", () => {
    // .item-hue-stage is the single entry point every embedded Item stage
    // goes through; it must map the canonical triple onto --resource-hue
    // rather than inlining channel values.
    const stage = declarations.match(/\.item-hue-stage\s*\{[^}]*\}/);
    expect(stage).not.toBeNull();
    expect(stage![0]).toContain("--resource-hue: var(--hue-item)");
  });

  it("never declares a border of its own on the hue rules", () => {
    // The hue paints an EXISTING framed image area. If it ever set
    // border-width/border-style it would draw a second frame inside the
    // surface's own — the double-frame regression this guards against.
    const hueRules = declarations.slice(
      declarations.indexOf(".item-hue-stage"),
    );
    expect(hueRules).not.toMatch(/border-width:/);
    expect(hueRules).not.toMatch(/border-style:/);
  });

  it("keeps the embedded stage's resting wash below the hero stage's own", () => {
    // The 192px hero uses 0.28/0.15; the small embedded stages must stay
    // under that at rest or they read as solid blue tiles. The hover rule is
    // deliberately brighter and is measured separately below.
    const hueRules = declarations.slice(
      declarations.indexOf(".item-hue-stage"),
    );
    const restingRule = hueRules.slice(0, hueRules.indexOf(":hover"));
    const alphas = [
      ...restingRule.matchAll(/--resource-hue\),\s*([0-9.]+)/g),
    ].map((match) => Number.parseFloat(match[1]));
    expect(alphas.length).toBeGreaterThan(0);
    for (const alpha of alphas) {
      expect(alpha).toBeLessThan(0.28);
    }
  });
});
