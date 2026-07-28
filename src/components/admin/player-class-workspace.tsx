// The Player Class workspace wrapper (Player Classes + Recipe EXP
// milestone) — mirrors src/components/admin/profession-workspace.tsx's
// shape exactly: AdminWorkspace with the shared RecordList in its
// recordList slot and the page's own content in the primary region. This
// is deliberately the only Player-Class-specific layer: it owns the
// Player Class list query (name/slug search, client-side instant filter
// via RecordList) and the Player Class URL construction (via the pure
// helpers in src/lib/admin/player-class-workspace.ts); the shared
// components underneath stay resource-agnostic. Not a generic
// resource-query framework — this is a fifth, independent thin wrapper
// (after Item, Recipe, Profession, Category, Location), not a shared base
// class.

import { prisma } from "@/lib/db";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import { getImagePublicUrl } from "@/lib/storage/images";
import {
  PLAYER_CLASS_CREATE_PATH,
  PLAYER_CLASS_LIST_PATH,
  playerClassEditHref,
  normalizePlayerClassSearchQuery,
  withPlayerClassSearchQuery,
} from "@/lib/admin/player-class-workspace";

type PlayerClassWorkspaceProps = {
  /** Raw ?q= value from the page's searchParams; normalized here. */
  rawQuery?: string;
  /** Slug of the Player Class open in the editor (edit/delete routes) —
      marks the selected row. Landing and create pages pass nothing. */
  selectedSlug?: string;
  /** The page-level header region for list/landing pages only — editor
      pages pass their own EditorHeader/EditorTabs/error content through
      `editorHeader` instead. */
  header?: React.ReactNode;
  /** The selected Player Class's own EditorHeader/EditorTabs/error banner,
      passed straight through to AdminWorkspace's editorHeader slot. */
  editorHeader?: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form, or
      delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel (image/verification/timestamp
      panels), matching the slot AdminWorkspace already exposes. */
  aside?: React.ReactNode;
  /** Builds each record row's link — defaults to the General edit route.
      The Recipes tab route passes `playerClassRecipesHref` so quick
      switching between Player Classes stays on the Recipes tab instead of
      dropping back to General. */
  recordHref?: (slug: string, query: string) => string;
};

export async function PlayerClassWorkspace({
  rawQuery,
  selectedSlug,
  header,
  editorHeader,
  children,
  aside,
  recordHref = playerClassEditHref,
}: PlayerClassWorkspaceProps) {
  const query = normalizePlayerClassSearchQuery(rawQuery);

  // The COMPLETE list, always — filtering is instant and client-side
  // (RecordList's own established pattern), so there is no server-side
  // `where`/`q` filter and no pagination `skip`/`take` here at all.
  // Alphabetical, matching every other converted resource. The recipe
  // _count is loaded alongside (never the full relation) so the
  // secondary row context below never triggers an N+1 query.
  const playerClasses = await prisma.playerClass.findMany({
    orderBy: { name: "asc" },
  });

  // Resolved concurrently — image is already a scalar field on every row
  // from the query above (include only adds the recipe _count), so this
  // is pure URL construction, never a second database query.
  const imageUrls = await Promise.all(
    playerClasses.map((playerClass) => getImagePublicUrl(playerClass.image))
  );

  const rows = playerClasses.map((playerClass, index) => ({
    href: recordHref(playerClass.slug, query),
    primary: playerClass.name,
    slug: playerClass.slug,
    selected: playerClass.slug === selectedSlug,
    image: imageUrls[index],
  }));

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Classes"
          listPath={PLAYER_CLASS_LIST_PATH}
          initialQuery={query}
          searchLabel="Search classes"
          createHref={withPlayerClassSearchQuery(PLAYER_CLASS_CREATE_PATH, query)}
          createLabel="+ New"
          rows={rows}
          showImages
          noun={{ singular: "class", plural: "classes" }}
          empty={
            <p>
              No classes yet. Use &ldquo;+ New&rdquo; to create the first
              one.
            </p>
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
