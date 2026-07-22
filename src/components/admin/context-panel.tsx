// Shared contextual panel (Slice 9B.2): the bordered card the workspace
// aside column is built from — image, verification, and timestamp
// content all sit inside one of these. Title as a real heading (h2, so
// panels slot under the page's h1), optional description, a content
// slot, and an optional footer/action area separated by a rule.

type ContextPanelProps = {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  /** Appended alongside the base "admin-panel" class (e.g. the Danger
      zone's own danger-tinted border/heading) — never a replacement. */
  className?: string;
  children: React.ReactNode;
};

export function ContextPanel({
  title,
  description,
  footer,
  className,
  children,
}: ContextPanelProps) {
  return (
    <section className={className ? `admin-panel ${className}` : "admin-panel"}>
      <h2 className="admin-panel-title">{title}</h2>

      {description ? (
        <p className="admin-panel-description">{description}</p>
      ) : null}

      <div className="admin-panel-body">{children}</div>

      {footer ? <div className="admin-panel-footer">{footer}</div> : null}
    </section>
  );
}
