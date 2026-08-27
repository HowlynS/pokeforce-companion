import { EditorTabs } from "./editor-tabs";

type UsersAccessTab = "members" | "roles";

export function UsersAccessTabs({ active }: { active: UsersAccessTab }) {
  return (
    <EditorTabs
      label="Users and access sections"
      tabs={[
        {
          label: "Members",
          href: "/admin/users",
          active: active === "members",
        },
        {
          label: "Role policies",
          href: "/admin/users/roles",
          active: active === "roles",
        },
      ]}
    />
  );
}
