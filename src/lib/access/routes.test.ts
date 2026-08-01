import { describe, expect, it } from "vitest";
import { isMinimumPublicPath, requiresPrivateSiteGate } from "./routes";

describe("private-site route classification", () => {
  it.each(["/login", "/access-denied", "/robots.txt", "/sitemap.xml"])(
    "keeps %s reachable without the ordinary-site gate",
    (pathname) => expect(isMinimumPublicPath(pathname)).toBe(true)
  );

  it.each(["/", "/items", "/items/iron-ore", "/search", "/admin", "/admin/design-review"])(
    "gates %s while the site is private",
    (pathname) => expect(requiresPrivateSiteGate(pathname)).toBe(true)
  );
});
