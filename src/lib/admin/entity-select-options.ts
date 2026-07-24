// Shared helper (Admin Polish Pass 1) resolving a list of image-enabled
// entity records (Item, Recipe, Profession, Category, Location — and any
// future entity with the same id/name/image shape) into AdminSelectOption
// objects carrying a resolved public imageUrl, so every dropdown that
// selects one of these entities builds its icon-enabled options the same
// way instead of repeating the same Promise.all/getImagePublicUrl mapping
// per page. Deliberately generic (plain string fields, never a Prisma
// type import) — AdminSelect itself stays uncoupled from Prisma too.
//
// getImagePublicUrl does no network I/O (pure Supabase Storage URL
// construction), so resolving N records concurrently via Promise.all adds
// no meaningful cost even for a full Item/Location list.

import { getImagePublicUrl } from "@/lib/storage/images";
import type { AdminSelectOption } from "@/components/admin/admin-select";

type ImageEnabledRecord = {
  id: string;
  name: string;
  image: string | null;
};

/** Resolves each record's stored image path to a public URL (or null) and
    maps it to an icon-enabled AdminSelectOption keyed by id/name. */
export async function toEntitySelectOptions(
  records: readonly ImageEnabledRecord[]
): Promise<AdminSelectOption[]> {
  return Promise.all(
    records.map(async (record) => ({
      value: record.id,
      label: record.name,
      imageUrl: await getImagePublicUrl(record.image),
    }))
  );
}
