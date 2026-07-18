// The Profession workspace wrapper (Slice 9D.1) — the THIRD production
// composition of the shared workspace pieces, following the Item
// (src/components/admin/item-workspace.tsx) and Recipe
// (src/components/admin/recipe-workspace.tsx) workspaces' precedent
// exactly: AdminWorkspace with the shared RecordList in its recordList
// slot and the page's own content in the primary region. This is
// deliberately the only Profession-specific layer: it owns the
// Profession list query (name/slug search, server-side,
// case-insensitive) and the Profession URL construction (via the pure
// helpers in src/lib/admin/profession-workspace.ts); the shared
// components underneath stay resource-agnostic. Not a generic
// resource-query framework — this is a third, independent thin wrapper,
// not a shared base class.

import { prisma } from "@/lib/db";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import {
  PROFESSION_CREATE_PATH,
  PROFESSION_LIST_PATH,
  professionEditHref,
  normalizeProfessionSearchQuery,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";

type ProfessionWorkspaceProps = {
  /** Raw ?q= value from the page's searchParams; normalized here. */
  rawQuery?: string;
  /** Slug of the profession open in the editor (edit/delete routes) —
      marks the selected row. Landing and create pages pass nothing. */
  selectedSlug?: string;
  /** The page's header region (PageHeader plus any toolbar/banners). */
  header: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form, or
      delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel, unused in this pass — reserved for
      a later slice (image/verification panels), matching the slot
      AdminWorkspace already exposes. */
  aside?: React.ReactNode;
};

export async function ProfessionWorkspace({
  rawQuery,
  selectedSlug,
  header,
  children,
  aside,
}: ProfessionWorkspaceProps) {
  const query = normalizeProfessionSearchQuery(rawQuery);

  // Server-side filtering on name OR slug, case-insensitive — the same
  // trimmed-query posture the Item and Recipe workspaces use. No query
  // means the full list, alphabetical like the previous admin table. The
  // recipe _count is loaded alongside (never the full relation) so the
  // secondary row context below never triggers an N+1 query.
  const professions = await prisma.profession.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { recipes: true } } },
    orderBy: { name: "asc" },
  });

  const rows = professions.map((profession) => ({
    href: professionEditHref(profession.slug, query),
    primary: profession.name,
    secondary: `${profession._count.recipes} ${
      profession._count.recipes === 1 ? "recipe" : "recipes"
    }`,
    selected: profession.slug === selectedSlug,
  }));

  const countLabel = query
    ? `${professions.length} ${professions.length === 1 ? "match" : "matches"}`
    : `${professions.length} ${
        professions.length === 1 ? "profession" : "professions"
      }`;

  return (
    <AdminWorkspace
      header={header}
      aside={aside}
      recordList={
        <RecordList
          label="Professions"
          searchAction={PROFESSION_LIST_PATH}
          searchValue={query}
          searchLabel="Search professions"
          createHref={withProfessionSearchQuery(PROFESSION_CREATE_PATH, query)}
          createLabel="+ New profession"
          rows={rows}
          countLabel={countLabel}
          empty={
            query ? (
              // Distinct no-match state: the applied query is shown, and
              // the list's own Clear link (rendered because a query is
              // active) is the way out.
              <p style={{ margin: 0 }}>
                No professions match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                No professions yet. Use &ldquo;+ New profession&rdquo; to
                create the first one.
              </p>
            )
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
