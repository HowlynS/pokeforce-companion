"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  parseGameVersionEditInput,
  parseGameVersionInput,
} from "@/lib/validation/game-version";
import {
  createGameVersion,
  deleteGameVersion,
  setCurrentGameVersion,
  updateGameVersion,
} from "@/lib/game-versions";

const LIST_PATH = "/admin/settings/game-versions";

export async function createGameVersionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseGameVersionInput(formData);

  if (!parsed.ok) {
    redirect(`${LIST_PATH}?error=${parsed.error}`);
  }

  // All current-version rules live in the shared service module: the very
  // first version ever created becomes current automatically; every later
  // one starts as a selectable historical version.
  const result = await createGameVersion(prisma, parsed.value);

  if (!result.ok) {
    redirect(`${LIST_PATH}?error=${result.error}`);
  }

  revalidatePath(LIST_PATH);

  redirect(
    result.madeCurrent
      ? `${LIST_PATH}?success=created_current`
      : `${LIST_PATH}?success=created`
  );
}

export async function updateGameVersionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const editPath = id ? `${LIST_PATH}/${id}/edit` : null;

  if (!id) {
    redirect(`${LIST_PATH}?error=missing_version`);
  }

  const parsed = parseGameVersionEditInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? LIST_PATH}?error=${parsed.error}`);
  }

  // Name, release date, and description are editable here; the current
  // flag moves exclusively through markGameVersionCurrentAction, and
  // verification stamps referencing this version follow the rename
  // automatically.
  const result = await updateGameVersion(prisma, id, parsed.value);

  if (!result.ok) {
    if (result.error === "missing_version") {
      redirect(`${LIST_PATH}?error=missing_version`);
    }
    redirect(`${editPath ?? LIST_PATH}?error=${result.error}`);
  }

  revalidatePath(LIST_PATH);
  if (editPath) {
    revalidatePath(editPath);
  }

  redirect(`${LIST_PATH}?success=updated`);
}

export async function markGameVersionCurrentAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect(`${LIST_PATH}?error=missing_version`);
  }

  // The service transaction unsets the previous current version in the
  // same commit, so "at most one current" always holds. A tampered or
  // stale id is rejected as missing — never silently applied.
  const result = await setCurrentGameVersion(prisma, id);

  if (!result.ok) {
    redirect(`${LIST_PATH}?error=missing_version`);
  }

  revalidatePath(LIST_PATH);

  redirect(`${LIST_PATH}?success=marked_current`);
}

export async function deleteGameVersionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const confirmPath = id ? `${LIST_PATH}/${id}/delete` : LIST_PATH;

  if (!id) {
    redirect(`${LIST_PATH}?error=missing_version`);
  }

  // The service refuses to delete a referenced version (friendly pre-check
  // backed by the database's ON DELETE RESTRICT), so historical
  // verification stamps can never lose the version they point at.
  const result = await deleteGameVersion(prisma, id);

  if (!result.ok) {
    if (result.error === "missing_version") {
      redirect(`${LIST_PATH}?error=missing_version`);
    }
    redirect(`${confirmPath}?error=referenced`);
  }

  revalidatePath(LIST_PATH);
  revalidatePath(confirmPath);

  // Admin Polish Pass 2, Part 3: the shared success toast's namespaced
  // code (Game Versions keep their own list-oriented create/update
  // workflow untouched — only delete migrates, since it's the one
  // outcome explicitly required to show a toast here).
  redirect(`${LIST_PATH}?success=game_version_deleted`);
}
