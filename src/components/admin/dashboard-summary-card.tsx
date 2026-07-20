// Shared dashboard resource summary card (Slice 9G.1; moved off inline
// styles onto shared classes in Slice 9H): resource name, total record
// count, optional concise supporting context, and a single direct link
// to the resource's own workspace. The whole card is ONE anchor —
// mirroring the existing Card component's own linked-card pattern —
// never a click handler masquerading as a link, so ordinary
// keyboard/anchor navigation always works. Uses the gold accent that
// styles the rest of the admin shell.

type DashboardSummaryCardProps = {
  title: string;
  href: string;
  count: number;
  unitLabel: string;
  context?: string;
};

export function DashboardSummaryCard({
  title,
  href,
  count,
  unitLabel,
  context,
}: DashboardSummaryCardProps) {
  return (
    <a href={href} className="interactive-card admin-dashboard-card">
      <h3 className="admin-dashboard-card-title">{title}</h3>

      <p className="admin-dashboard-card-count">{count}</p>

      <p className="admin-dashboard-card-unit">{unitLabel}</p>

      {context ? (
        <p className="admin-dashboard-card-context">{context}</p>
      ) : null}
    </a>
  );
}
