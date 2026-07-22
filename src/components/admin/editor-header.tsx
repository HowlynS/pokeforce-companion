// Shared editor header for the upcoming resource workspaces (Slice 9B.2):
// optional back link, the record title as the page's one h1, optional
// subtitle, optional status content (e.g. a verification badge), and an
// optional action slot. Resource-agnostic — the caller supplies every
// string and node. Denser than the public PageHeader on purpose (compact
// desktop editor density); PageHeader remains the right header for list
// and public pages.

type EditorHeaderProps = {
  /** The record/workspace title — rendered as the page's one h1. */
  title: string;
  /** Small label above the title identifying the resource type (e.g.
      "Item", "Recipe") — the first rung of the header hierarchy, kept
      outside the h1 so the page's accessible heading stays exactly the
      title, matching PageHeader's own eyebrow/h1 split. */
  eyebrow?: string;
  /** Optional supporting context under the title (e.g. slug or type). */
  subtitle?: string;
  /** Optional back/context navigation above the title. */
  backHref?: string;
  backLabel?: string;
  /** Optional status content rendered beside the title (badges, notes). */
  status?: React.ReactNode;
  /** Optional actions rendered at the header's far edge. */
  actions?: React.ReactNode;
};

export function EditorHeader({
  title,
  eyebrow,
  subtitle,
  backHref,
  backLabel,
  status,
  actions,
}: EditorHeaderProps) {
  return (
    <header className="admin-editor-header">
      {backHref ? (
        <a href={backHref} className="admin-editor-header-back">
          &larr; {backLabel ?? "Back"}
        </a>
      ) : null}

      {eyebrow ? <p className="admin-editor-eyebrow">{eyebrow}</p> : null}

      <div className="admin-editor-header-row">
        <div className="admin-editor-header-heading">
          <h1 className="admin-editor-title">{title}</h1>
          {status ?? null}
        </div>

        {actions ? (
          <div className="admin-editor-header-actions">{actions}</div>
        ) : null}
      </div>

      {subtitle ? <p className="admin-editor-subtitle">{subtitle}</p> : null}
    </header>
  );
}
