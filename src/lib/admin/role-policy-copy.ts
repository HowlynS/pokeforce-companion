// Presentational copy for the three ordinary roles (Users & access visual
// polish pass). ONE place the role rail and the selected-role identity
// block read their wording from, so the two can never drift apart.
//
// This is product language only. It carries no authority of its own: what
// a role may actually do comes from the stored role grants resolved
// through the permission registry, never from this file. Owner is
// deliberately absent — Owner is system-protected, is not an editable
// role policy, and must never appear as a selectable option here.

import type { OrdinaryUserRole } from "@/lib/auth/permission-read-model";

export type OrdinaryRoleCopy = Readonly<{
  /** The two-or-three word line shown beside the role name in the rail. */
  tagline: string;
  /** One sentence for the selected-role identity block. */
  summary: string;
}>;

export const ORDINARY_ROLE_COPY: Readonly<
  Record<OrdinaryUserRole, OrdinaryRoleCopy>
> = {
  MEMBER: {
    tagline: "Reference access",
    summary:
      "Approved readers of the Codex. The baseline every signed-in member starts from.",
  },
  CONTRIBUTOR: {
    tagline: "Propose changes",
    summary:
      "Trusted members who submit Codex changes for review rather than publishing directly.",
  },
  ADMINISTRATOR: {
    tagline: "Maintain the Codex",
    summary:
      "Operational content managers who keep the Codex accurate, with configurable permissions.",
  },
};
