// Shared dashboard resource module (Slice 9G.1; restructured in Visual
// Pass II Section 8): resource name, total record count, optional concise
// supporting context, all inside one linked summary area, PLUS a
// full-width attached create action beneath it, separated by a divider —
// never a small button floating inside the summary card. The summary and
// the action are two separate anchors (the summary still links to the
// resource's own list/workspace, exactly as before; the action links to
// its create route), both ordinary keyboard/anchor navigation, never a
// click handler. Uses the gold accent that styles the rest of the admin
// shell.

type DashboardSummaryCardProps = {
  title: string;
  href: string;
  count: number;
  unitLabel: string;
  context?: string;
  createHref: string;
  createLabel: string;
};

export function DashboardSummaryCard({
  title,
  href,
  count,
  unitLabel,
  context,
  createHref,
  createLabel,
}: DashboardSummaryCardProps) {
  return (
    <div className="admin-dashboard-card">
      <a href={href} className="admin-dashboard-card-summary">
        <h3 className="admin-dashboard-card-title">{title}</h3>

        <p className="admin-dashboard-card-count">{count}</p>

        <p className="admin-dashboard-card-unit">{unitLabel}</p>

        {context ? (
          <p className="admin-dashboard-card-context">{context}</p>
        ) : null}
      </a>

      <a href={createHref} className="admin-dashboard-card-action">
        {createLabel}
      </a>
    </div>
  );
}
