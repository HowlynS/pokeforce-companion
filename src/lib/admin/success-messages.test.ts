import { describe, expect, it } from "vitest";
import {
  ADMIN_SUCCESS_MESSAGES,
  adminSuccessMessage,
  removeSuccessParam,
} from "./success-messages";

describe("adminSuccessMessage", () => {
  it("returns the mapped message for a known code", () => {
    expect(adminSuccessMessage("item_created")).toBe("Item created");
    expect(adminSuccessMessage("item_saved")).toBe("Item saved");
    expect(adminSuccessMessage("item_deleted")).toBe("Item deleted");
  });

  it("returns the mapped message for every resource's create/save/delete code", () => {
    expect(adminSuccessMessage("recipe_created")).toBe("Recipe created");
    expect(adminSuccessMessage("recipe_saved")).toBe("Recipe saved");
    expect(adminSuccessMessage("recipe_deleted")).toBe("Recipe deleted");
    expect(adminSuccessMessage("profession_created")).toBe("Profession created");
    expect(adminSuccessMessage("profession_saved")).toBe("Profession saved");
    expect(adminSuccessMessage("profession_deleted")).toBe("Profession deleted");
    expect(adminSuccessMessage("category_created")).toBe("Category created");
    expect(adminSuccessMessage("category_saved")).toBe("Category saved");
    expect(adminSuccessMessage("category_deleted")).toBe("Category deleted");
    expect(adminSuccessMessage("location_created")).toBe("Location created");
    expect(adminSuccessMessage("location_saved")).toBe("Location saved");
    expect(adminSuccessMessage("location_deleted")).toBe("Location deleted");
    expect(adminSuccessMessage("source_created")).toBe(
      "Acquisition source created"
    );
    expect(adminSuccessMessage("source_saved")).toBe("Acquisition source saved");
    expect(adminSuccessMessage("source_deleted")).toBe(
      "Acquisition source deleted"
    );
    expect(adminSuccessMessage("game_version_deleted")).toBe(
      "Game version deleted"
    );
  });

  it("returns the distinct ingredients/hierarchy save messages", () => {
    expect(adminSuccessMessage("ingredients_saved")).toBe("Ingredients saved");
    expect(adminSuccessMessage("hierarchy_saved")).toBe("Hierarchy saved");
  });

  it("returns the longer image-cleanup-caveat messages for every image-bearing resource", () => {
    expect(adminSuccessMessage("item_saved_image_cleanup")).toMatch(
      /Item saved, but the previous image file/
    );
    expect(adminSuccessMessage("item_deleted_image_cleanup")).toMatch(
      /Item deleted, but its image file/
    );
    expect(adminSuccessMessage("recipe_saved_image_cleanup")).toMatch(
      /Recipe saved, but/
    );
    expect(adminSuccessMessage("recipe_deleted_image_cleanup")).toMatch(
      /Recipe deleted, but/
    );
    expect(adminSuccessMessage("profession_saved_image_cleanup")).toMatch(
      /Profession saved, but/
    );
    expect(adminSuccessMessage("profession_deleted_image_cleanup")).toMatch(
      /Profession deleted, but/
    );
    expect(adminSuccessMessage("category_saved_image_cleanup")).toMatch(
      /Category saved, but/
    );
    expect(adminSuccessMessage("category_deleted_image_cleanup")).toMatch(
      /Category deleted, but/
    );
    expect(adminSuccessMessage("location_saved_image_cleanup")).toMatch(
      /Location saved, but/
    );
    expect(adminSuccessMessage("location_deleted_image_cleanup")).toMatch(
      /Location deleted, but/
    );
  });

  it("returns null for an unrecognized code, never a fallback message", () => {
    expect(adminSuccessMessage("not_a_real_code")).toBeNull();
  });

  it("returns null for an absent or empty code", () => {
    expect(adminSuccessMessage(null)).toBeNull();
    expect(adminSuccessMessage(undefined)).toBeNull();
    expect(adminSuccessMessage("")).toBeNull();
  });

  it("never matches an inherited Object.prototype property name", () => {
    expect(adminSuccessMessage("toString")).toBeNull();
    expect(adminSuccessMessage("constructor")).toBeNull();
    expect(adminSuccessMessage("hasOwnProperty")).toBeNull();
  });

  it("exposes a flat, fully-string-valued dictionary", () => {
    for (const value of Object.values(ADMIN_SUCCESS_MESSAGES)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("removeSuccessParam", () => {
  it("strips a lone success param entirely, leaving no query string", () => {
    expect(removeSuccessParam("success=item_saved")).toBe("");
    expect(removeSuccessParam("?success=item_saved")).toBe("");
  });

  it("preserves every other param, e.g. the record list's own q filter", () => {
    expect(removeSuccessParam("q=iron&success=item_saved")).toBe("?q=iron");
  });

  it("preserves param order and multiple surviving params", () => {
    expect(removeSuccessParam("a=1&success=item_saved&b=2")).toBe(
      "?a=1&b=2"
    );
  });

  it("returns an empty string, never a bare '?', when nothing remains", () => {
    expect(removeSuccessParam("success=item_saved")).not.toBe("?");
  });

  it("is a no-op when there is no success param to remove", () => {
    expect(removeSuccessParam("q=iron")).toBe("?q=iron");
    expect(removeSuccessParam("")).toBe("");
  });
});
