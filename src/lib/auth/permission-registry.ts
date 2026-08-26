export const PERMISSION_GROUPS = [
  "Access",
  "Contributions",
  "Items",
  "Recipes",
  "Professions",
  "Classes",
  "Locations",
  "Shops",
  "Currencies",
  "Categories",
  "Game Versions",
  "Site Appearance",
  "Users & Roles",
  "Activity History",
  "Site & System",
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export type PermissionDefinition = Readonly<{
  label: string;
  description: string;
  group: PermissionGroup;
  dangerous?: boolean;
  protected?: boolean;
}>;

export const PERMISSION_REGISTRY = {
  "site.access.private": {
    label: "Access the Private Codex",
    description: "Open the Codex while the site is in private beta.",
    group: "Access",
  },
  "admin.access": {
    label: "Access the Admin Workspace",
    description: "Open the workspace used to maintain Codex content.",
    group: "Access",
  },
  "contributions.submit": {
    label: "Submit Contributions",
    description: "Send proposed Codex changes for review.",
    group: "Contributions",
  },
  "contributions.withdraw-own": {
    label: "Withdraw Own Contributions",
    description: "Withdraw your own pending contributions.",
    group: "Contributions",
  },
  "contributions.review": {
    label: "Review Contributions",
    description: "Open Contributor changes and compare them with the live version.",
    group: "Contributions",
  },
  "contributions.approve": {
    label: "Approve Contributions",
    description: "Publish an accepted Contributor change to the live Codex.",
    group: "Contributions",
  },
  "contributions.reject": {
    label: "Reject Contributions",
    description: "Decline a Contributor change without publishing it.",
    group: "Contributions",
  },
  "content.images.manage": {
    label: "Manage Content Images",
    description: "Upload or replace images used by Codex content.",
    group: "Items",
  },
  "content.items.create": {
    label: "Create Items",
    description: "Add new Items to the Codex.",
    group: "Items",
  },
  "content.items.edit": {
    label: "Edit Items",
    description: "Change existing Item information.",
    group: "Items",
  },
  "content.items.delete": {
    label: "Delete Items",
    description: "Permanently remove Items from the Codex.",
    group: "Items",
    dangerous: true,
  },
  "content.items.verify": {
    label: "Verify Items",
    description: "Confirm Item information for the current game version.",
    group: "Items",
  },
  "content.recipes.create": {
    label: "Create Recipes",
    description: "Add new Recipes to the Codex.",
    group: "Recipes",
  },
  "content.recipes.edit": {
    label: "Edit Recipes",
    description: "Change existing Recipe information.",
    group: "Recipes",
  },
  "content.recipes.delete": {
    label: "Delete Recipes",
    description: "Permanently remove Recipes from the Codex.",
    group: "Recipes",
    dangerous: true,
  },
  "content.recipes.verify": {
    label: "Verify Recipes",
    description: "Confirm Recipe information for the current game version.",
    group: "Recipes",
  },
  "content.professions.create": {
    label: "Create Professions",
    description: "Add new Professions to the Codex.",
    group: "Professions",
  },
  "content.professions.edit": {
    label: "Edit Professions",
    description: "Change existing Profession information.",
    group: "Professions",
  },
  "content.professions.delete": {
    label: "Delete Professions",
    description: "Permanently remove Professions from the Codex.",
    group: "Professions",
    dangerous: true,
  },
  "content.professions.verify": {
    label: "Verify Professions",
    description: "Confirm Profession information for the current game version.",
    group: "Professions",
  },
  "content.classes.create": {
    label: "Create Classes",
    description: "Add new player Classes to the Codex.",
    group: "Classes",
  },
  "content.classes.edit": {
    label: "Edit Classes",
    description: "Change existing player Class information.",
    group: "Classes",
  },
  "content.classes.delete": {
    label: "Delete Classes",
    description: "Permanently remove player Classes from the Codex.",
    group: "Classes",
    dangerous: true,
  },
  "content.classes.verify": {
    label: "Verify Classes",
    description: "Confirm player Class information for the current game version.",
    group: "Classes",
  },
  "content.locations.create": {
    label: "Create Locations",
    description: "Add new Locations to the Codex.",
    group: "Locations",
  },
  "content.locations.edit": {
    label: "Edit Locations",
    description: "Change existing Location information.",
    group: "Locations",
  },
  "content.locations.delete": {
    label: "Delete Locations",
    description: "Permanently remove Locations from the Codex.",
    group: "Locations",
    dangerous: true,
  },
  "content.locations.verify": {
    label: "Verify Locations",
    description: "Confirm Location information for the current game version.",
    group: "Locations",
  },
  "content.shops.create": {
    label: "Create Shops",
    description: "Add new Shops to the Codex.",
    group: "Shops",
  },
  "content.shops.edit": {
    label: "Edit Shops",
    description: "Change Shop information and inventory.",
    group: "Shops",
  },
  "content.shops.delete": {
    label: "Delete Shops",
    description: "Permanently remove Shops from the Codex.",
    group: "Shops",
    dangerous: true,
  },
  "content.shops.verify": {
    label: "Verify Shops",
    description: "Confirm Shop information for the current game version.",
    group: "Shops",
  },
  "content.currencies.create": {
    label: "Create Currencies",
    description: "Add new Currencies to the Codex.",
    group: "Currencies",
  },
  "content.currencies.edit": {
    label: "Edit Currencies",
    description: "Change existing Currency information.",
    group: "Currencies",
  },
  "content.currencies.delete": {
    label: "Delete Currencies",
    description: "Permanently remove Currencies from the Codex.",
    group: "Currencies",
    dangerous: true,
  },
  "content.currencies.verify": {
    label: "Verify Currencies",
    description: "Confirm Currency information for the current game version.",
    group: "Currencies",
  },
  "content.categories.create": {
    label: "Create Categories",
    description: "Add new Item Categories to the Codex.",
    group: "Categories",
  },
  "content.categories.edit": {
    label: "Edit Categories",
    description: "Change existing Item Category information.",
    group: "Categories",
  },
  "content.categories.delete": {
    label: "Delete Categories",
    description: "Permanently remove Item Categories from the Codex.",
    group: "Categories",
    dangerous: true,
  },
  "content.game-versions.create": {
    label: "Create Game Versions",
    description: "Add new game releases used for verification.",
    group: "Game Versions",
  },
  "content.game-versions.edit": {
    label: "Edit Game Versions",
    description: "Change game release information or choose the current version.",
    group: "Game Versions",
  },
  "content.game-versions.delete": {
    label: "Delete Game Versions",
    description: "Permanently remove an unused game release.",
    group: "Game Versions",
    dangerous: true,
  },
  "site.appearance.manage": {
    label: "Manage Site Appearance",
    description: "Change the images and presentation settings used by the Codex.",
    group: "Site Appearance",
  },
  "site.design-review.view": {
    label: "View Design Review",
    description: "Open the internal workspace used to review interface components.",
    group: "Site Appearance",
  },
  "users.view": {
    label: "View Members",
    description: "See the Codex member directory and account status.",
    group: "Users & Roles",
  },
  "audit.view": {
    label: "View Activity History",
    description: "See important changes made to the Codex.",
    group: "Activity History",
  },
  "security.roles.permissions.manage": {
    label: "Manage Roles",
    description: "Choose what each ordinary role is allowed to do.",
    group: "Users & Roles",
    protected: true,
  },
  "security.members.create": {
    label: "Create Members",
    description: "Create a new member account for the Codex.",
    group: "Users & Roles",
    protected: true,
  },
  "security.members.roles.manage": {
    label: "Manage Member Roles",
    description: "Change a member's ordinary role.",
    group: "Users & Roles",
    protected: true,
  },
  "security.members.permissions.manage": {
    label: "Manage Personal Permissions",
    description: "Change permissions for one member without changing their role.",
    group: "Users & Roles",
    protected: true,
  },
  "security.members.status.manage": {
    label: "Manage Member Access",
    description: "Disable or restore a member's access to the Codex.",
    group: "Users & Roles",
    protected: true,
    dangerous: true,
  },
  "security.members.password.reset": {
    label: "Reset Member Passwords",
    description: "Set a temporary password for a member account.",
    group: "Users & Roles",
    protected: true,
    dangerous: true,
  },
  "site.visibility.manage": {
    label: "Manage Site Visibility",
    description: "Choose whether the Codex is private or publicly available.",
    group: "Site & System",
    protected: true,
    dangerous: true,
  },
  "security.ownership.manage": {
    label: "Manage Ownership",
    description: "Use protected ownership operations supported by the Codex.",
    group: "Site & System",
    protected: true,
    dangerous: true,
  },
} as const satisfies Record<string, PermissionDefinition>;

export type PermissionKey = keyof typeof PERMISSION_REGISTRY;

export const PERMISSION_KEYS = Object.freeze(
  Object.keys(PERMISSION_REGISTRY) as PermissionKey[]
);

export const ORDINARY_PERMISSION_KEYS = Object.freeze(
  PERMISSION_KEYS.filter((key) => !isProtectedPermission(key))
);

export const PROTECTED_PERMISSION_KEYS = Object.freeze(
  PERMISSION_KEYS.filter(isProtectedPermission)
);

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && value in PERMISSION_REGISTRY;
}

export function isProtectedPermission(key: PermissionKey): boolean {
  const definition: PermissionDefinition = PERMISSION_REGISTRY[key];
  return definition.protected === true;
}
