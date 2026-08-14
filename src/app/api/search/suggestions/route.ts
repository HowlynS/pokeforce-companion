import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeSearchQuery, searchGameData } from "@/lib/search/global-search";
import {
  buildQuickSearchGroups,
  isQuickSearchQuery,
} from "@/lib/search/quick-search";

export const dynamic = "force-dynamic";

/**
 * Suggestions for the header quick search.
 *
 * The header cannot query Prisma itself — it is a client component — so this
 * is the one small server surface between them. It runs the SAME
 * searchGameData the /search page runs, then applies the dropdown's own
 * presentation policy, so there is exactly one definition of a match in the
 * codebase. It returns public game data only: names, canonical hrefs, and the
 * existing relational context line. No database ids, no verification, no
 * counts.
 *
 * Access is governed by the site-visibility proxy like every other route, so
 * under PRIVATE_BETA an anonymous request is redirected to /login rather than
 * answered.
 */
export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q"));

  if (!isQuickSearchQuery(query)) {
    return NextResponse.json({ query, groups: [] });
  }

  const results = await searchGameData(prisma, query);

  return NextResponse.json({
    query,
    groups: buildQuickSearchGroups(results, query),
  });
}
