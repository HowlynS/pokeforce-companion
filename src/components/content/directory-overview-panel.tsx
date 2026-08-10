export type DirectoryOverviewStat = {
  label: string;
  value: string | number;
};

type DirectoryOverviewPanelProps = {
  title: string;
  stats: readonly DirectoryOverviewStat[];
};

/** Real, server-rendered summary stats beside a directory's content — no
    invented figures, every value comes from the page's own Prisma queries. */
export function DirectoryOverviewPanel({
  title,
  stats,
}: DirectoryOverviewPanelProps) {
  return (
    <aside className="directory-overview" aria-label={title}>
      <div className="directory-overview-heading">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span>{title}</span>
      </div>
      <dl className="directory-overview-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
