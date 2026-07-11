"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { parseProfessionInput } from "@/lib/validation/profession";

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

function isMissingRecordError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export async function createProfessionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseProfessionInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/professions?error=${parsed.error}`);
  }

  const existingByName = await prisma.profession.findFirst({
    where: { name: { equals: parsed.value.name, mode: "insensitive" } },
  });

  if (existingByName) {
    redirect("/admin/professions?error=duplicate_name");
  }

  try {
    await prisma.profession.create({ data: parsed.value });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/professions?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/professions");
  revalidatePath("/professions");

  redirect("/admin/professions?success=created");
}

export async function updateProfessionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug
    ? `/admin/professions/${originalSlug}/edit`
    : null;

  if (!id) {
    redirect("/admin/professions?error=missing_profession");
  }

  const parsed = parseProfessionInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/professions"}?error=${parsed.error}`);
  }

  const existingByName = await prisma.profession.findFirst({
    where: {
      name: { equals: parsed.value.name, mode: "insensitive" },
      NOT: { id },
    },
  });

  if (existingByName) {
    redirect(`${editPath ?? "/admin/professions"}?error=duplicate_name`);
  }

  try {
    // Located by the stable cuid `id`, not the editable slug, so changing
    // the slug in this same submission cannot lose the target record.
    await prisma.profession.update({ where: { id }, data: parsed.value });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/professions"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/professions?error=missing_profession");
    }
    throw error;
  }

  revalidatePath("/admin/professions");
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath("/professions");
  if (originalSlug) {
    revalidatePath(`/professions/${originalSlug}`);
  }
  if (parsed.value.slug !== originalSlug) {
    revalidatePath(`/professions/${parsed.value.slug}`);
  }

  redirect("/admin/professions?success=updated");
}

export async function deleteProfessionAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirmPath = slug
    ? `/admin/professions/${slug}/delete`
    : "/admin/professions";

  if (!id) {
    redirect("/admin/professions?error=missing_profession");
  }

  const profession = await prisma.profession.findUnique({
    where: { id },
    include: { _count: { select: { recipes: true } } },
  });

  if (!profession) {
    redirect("/admin/professions?error=missing_profession");
  }

  // Checked immediately before deletion, not just on the confirmation page
  // load, so a concurrently-linked recipe can't slip through. The
  // application rule is that linked professions are preserved until their
  // recipes are manually reassigned in a later slice — never silently
  // detached.
  if (profession._count.recipes > 0) {
    redirect(`${confirmPath}?error=linked_recipes`);
  }

  try {
    await prisma.profession.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/professions?error=missing_profession");
    }
    throw error;
  }

  revalidatePath("/admin/professions");
  revalidatePath(confirmPath);
  revalidatePath("/professions");
  revalidatePath(`/professions/${profession.slug}`);

  redirect("/admin/professions?success=deleted");
}
