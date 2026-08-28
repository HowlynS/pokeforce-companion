// The Owner's system-protected powers, on both the role policy page and
// one member's detail page (Users & access visual polish pass).
//
// Deliberately NOT the same row shape as an ordinary permission: these
// are not settings that happen to be switched off, so they get no
// control column, no per-row "Owner protected" pill repeating what the
// panel already states once, and no far-right state chip stranded across
// an ultrawide row. A tinted panel, one lock, one lead sentence, and a
// compact tile grid read as "intentionally reserved" rather than
// "disabled by a bug".

import { Lock } from "lucide-react";
import type { ReactNode } from "react";

export type ProtectedPermissionEntry = Readonly<{
  key: string;
  label: string;
  description: string;
  /** Optional short marker rendered inside the tile — the member view
      uses it to state the Owner's own effective access. */
  note?: string;
}>;

export function ProtectedPermissionPanel({
  lead,
  entries,
  footnote,
}: {
  lead: string;
  entries: readonly ProtectedPermissionEntry[];
  footnote?: ReactNode;
}) {
  return (
    <section className="security-protected-panel">
      <div className="security-protected-panel-heading">
        <span className="security-protected-panel-icon" aria-hidden="true">
          <Lock size={15} strokeWidth={2} />
        </span>
        <div>
          <h2 className="security-protected-panel-title">
            Protected Owner Permissions
          </h2>
          <p className="security-protected-panel-lead">{lead}</p>
        </div>
      </div>

      <ul className="security-protected-grid">
        {entries.map((entry) => (
          <li className="security-protected-tile" key={entry.key}>
            <strong>{entry.label}</strong>
            <p>{entry.description}</p>
            {entry.note ? (
              <span className="security-protected-note">{entry.note}</span>
            ) : null}
          </li>
        ))}
      </ul>

      {footnote ? (
        <p className="security-protected-panel-footnote">{footnote}</p>
      ) : null}
    </section>
  );
}
