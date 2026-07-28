export const RESOURCE_LINK_SEARCH_MIN_LENGTH = 2;
export const RESOURCE_LINK_SEARCH_LIMIT = 24;

export type ResourceLinkOption = {
  type:
    | "Item"
    | "Recipe"
    | "Profession"
    | "Class"
    | "Category"
    | "Location"
    | "Shop";
  name: string;
  href: string;
  context: string | null;
};
