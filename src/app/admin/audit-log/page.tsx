import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EditorSection } from "@/components/admin/editor-section";
import { AdminSelect } from "@/components/admin/admin-select";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function targetHref(type: string, id: string | null): string | null {
  if (!id) return null;
  if (type === "USER") return "/admin/users";
  if (type === "SITE_VISIBILITY") return "/admin/users";
  return null;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("audit.view");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const query = params.q?.trim().slice(0, 100) ?? "";
  const actor = params.actor?.trim().slice(0, 100) ?? "";
  const action = params.action?.trim().slice(0, 100) ?? "";
  const targetType = params.targetType?.trim().slice(0, 100) ?? "";
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  const where = {
    ...(query ? { OR: [
      { actorEmailSnapshot: { contains: query, mode: "insensitive" as const } },
      { actorDisplayNameSnapshot: { contains: query, mode: "insensitive" as const } },
      { targetLabelSnapshot: { contains: query, mode: "insensitive" as const } },
      { action: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
    ...(actor ? { actorEmailSnapshot: { contains: actor, mode: "insensitive" as const } } : {}),
    ...(action ? { action } : {}),
    ...(targetType ? { targetType } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [events, total, actionValues, targetValues] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditEvent.findMany({ distinct: ["targetType"], select: { targetType: true }, orderBy: { targetType: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader eyebrow="Admin · Site administration" title="Audit log" description="Append-only history of access, site-administration, and gameplay changes. Newest events appear first." />
      <EditorSection title="Audit history" icon={SECTION_ICONS.timestamps}>
        <form method="get" className="form-grid form-grid-responsive" style={{ marginBottom: "20px" }}>
          <label className="form-field"><span className="form-field-label">Search</span><input className="form-input" type="search" name="q" defaultValue={query} /></label>
          <label className="form-field"><span className="form-field-label">Actor email</span><input className="form-input" type="search" name="actor" defaultValue={actor} /></label>
          <label className="form-field"><span className="form-field-label">Action</span><AdminSelect name="action" defaultValue={action} options={[{ value: "", label: "All actions" }, ...actionValues.map((entry) => ({ value: entry.action, label: entry.action.replaceAll(".", " · ") }))]} /></label>
          <label className="form-field"><span className="form-field-label">Target type</span><AdminSelect name="targetType" defaultValue={targetType} options={[{ value: "", label: "All targets" }, ...targetValues.map((entry) => ({ value: entry.targetType, label: entry.targetType.replaceAll("_", " ") }))]} /></label>
          <label className="form-field"><span className="form-field-label">From</span><input className="form-input" type="date" name="from" defaultValue={params.from} /></label>
          <label className="form-field"><span className="form-field-label">To</span><input className="form-input" type="date" name="to" defaultValue={params.to} /></label>
          <button type="submit" className="btn btn-secondary">Apply filters</button>
        </form>

        {events.length ? (
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>{events.map((event) => {
              const href = targetHref(event.targetType, event.targetId);
              const metadata = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
                ? Object.entries(event.metadata)
                : [];
              return <tr key={event.id}>
                <td>{formatDisplayDate(event.createdAt)}</td>
                <td>{event.actorDisplayNameSnapshot || event.actorEmailSnapshot}<span className="admin-table-meta">{event.actorDisplayNameSnapshot ? event.actorEmailSnapshot : ""}</span></td>
                <td>{event.action.replaceAll(".", " · ")}</td>
                <td>{href ? <Link href={href}>{event.targetLabelSnapshot}</Link> : event.targetLabelSnapshot}<span className="admin-table-meta">{event.targetType.replaceAll("_", " ")}</span></td>
                <td>{metadata.length ? <details><summary>Show changed fields</summary><dl className="admin-panel-dl">{metadata.map(([key, value]) => <div className="admin-panel-row" key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl></details> : <span className="text-muted">No additional fields</span>}</td>
              </tr>;
            })}</tbody>
          </table></div>
        ) : <EmptyState title="No matching audit events" description="Adjust the filters or perform an audited administrative action." />}

        {pages > 1 ? <nav aria-label="Audit pagination" className="catalogue-pagination">
          {page > 1 ? <Link href={{ query: { ...params, page: String(page - 1) } }}>Previous</Link> : <span />}
          <span>Page {Math.min(page, pages)} of {pages}</span>
          {page < pages ? <Link href={{ query: { ...params, page: String(page + 1) } }}>Next</Link> : <span />}
        </nav> : null}
      </EditorSection>
    </>
  );
}
