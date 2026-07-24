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
//
// Slice 9D.3 added the optional `recordHref` prop, mirroring
// `ItemWorkspace`'s own (Slice 9B.6): the Recipes tab route passes
// `professionRecipesHref` so quick switching stays on that tab.

import { prisma } from "@/lib/db";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import { getImagePublicUrl } from "@/lib/storage/images";
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
  /** The page's header region (PageHeader plus any toolbar/banners) for
      list/landing pages. Editor pages (create/edit/tab routes) no longer
      pass this — their own EditorHeader/EditorTabs/error content now
      renders as the first children instead (Visual Pass II Section 3). */
  header?: React.ReactNode;
  /** The selected profession's own EditorHeader/EditorTabs/error banner
      (Visual Pass II correction pass, Section 3) — passed straight
      through to AdminWorkspace's editorHeader slot. */
  editorHeader?: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form, or
      delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel, unused in this pass — reserved for
      a later slice (image/verification panels), matching the slot
      AdminWorkspace already exposes. */
  aside?: React.ReactNode;
  /** Builds each record row's link (Slice 9D.3) — defaults to the
      General edit route. The Recipes tab route passes
      `professionRecipesHref` so quick switching between professions
      stays on the Recipes tab instead of dropping back to General,
      mirroring `ItemWorkspace`'s own `recordHref` prop. */
  recordHref?: (slug: string, query: string) => string;
};

export async function ProfessionWorkspace({
  rawQuery,
  selectedSlug,
  header,
  editorHeader,
  children,
  aside,
  recordHref = professionEditHref,
}: ProfessionWorkspaceProps) {
  const query = normalizeProfessionSearchQuery(rawQuery);

  // The COMPLETE list, always — filtering is now instant and client-side
  // (Phase B1, System A), so there is no server-side `where`/`q` filter
  // and no pagination `skip`/`take` here at all. Alphabetical, matching
  // the previous admin table's own ordering. The recipe _count is loaded
  // alongside (never the full relation) so the secondary row context
  // below never triggers an N+1 query.
  const professions = await prisma.profession.findMany({
    include: { _count: { select: { recipes: true } } },
    orderBy: { name: "asc" },
  });

  // Resolved concurrently — image is already a scalar field on every row
  // from the query above (include only adds the recipe _count), so this
  // is pure URL construction, never a second database query.
  const imageUrls = await Promise.all(
    professions.map((profession) => getImagePublicUrl(profession.image))
  );

  const rows = professions.map((profession, index) => ({
    href: recordHref(profession.slug, query),
    primary: profession.name,
    slug: profession.slug,
    secondary: `${profession._count.recipes} ${
      profession._count.recipes === 1 ? "recipe" : "recipes"
    }`,
    selected: profession.slug === selectedSlug,
    image: imageUrls[index],
  }));

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Professions"
          listPath={PROFESSION_LIST_PATH}
          initialQuery={query}
          searchLabel="Search professions"
          createHref={withProfessionSearchQuery(PROFESSION_CREATE_PATH, query)}
          createLabel="+ New"
          rows={rows}
          showImages
          noun={{ singular: "profession", plural: "professions" }}
          empty={
            <p>
              No professions yet. Use &ldquo;+ New&rdquo; to
              create the first one.
            </p>
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
