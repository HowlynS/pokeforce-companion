// Shared band for one registry permission group (Users & access visual
// polish pass). The permission ledger shows ~15 groups on one page, so
// wrapping each in its own bordered EditorSection card produced fifteen
// identical shells with fifteen identical icons — bulk without hierarchy.
// A band instead carries the hierarchy in typography and one hairline
// rule: the group title is the loud thing, the rows below it are quiet.
//
// The heading stays an h2 because the page's own EditorHeader title is
// the only heading above it, exactly like EditorSection's default.

import type { ReactNode } from "react";

export function PermissionGroupSection({
  title,
  meta,
  columns,
  children,
}: {
  title: string;
  /** Short state summary — e.g. "4 of 5 allowed". Never a raw count of
      rows, which the rows themselves already show. */
  meta?: string;
  /** Optional column-header strip, rendered under the heading rule. Used
      by the member ledger, whose rows carry three separate states. */
  columns?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="security-group">
      <div className="security-group-heading">
        <h2 className="security-group-title">{title}</h2>
        {meta ? <p className="security-group-meta">{meta}</p> : null}
      </div>
      {columns ? <div className="security-group-columns">{columns}</div> : null}
      <div className="security-group-body">{children}</div>
    </section>
  );
}
