"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  isForeignKeyError,
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";
import { parseRecipeInput } from "@/lib/validation/recipe";
import { isRecipeNameTaken } from "@/lib/admin/record-name";
import {
  deleteImage,
  uploadImage,
  validateImageFile,
} from "@/lib/storage/images";

// Browsers submit an empty File for an untouched file input, so both a
// missing value and a zero-byte value mean "no image was chosen".
function getSubmittedImageFile(formData: FormData): File | null {
  const value = formData.get("image");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

// Best-effort storage cleanup. Storage and the database cannot share a
// transaction, so a failed delete here must never replace or hide the
// outcome the user actually needs to see; the failure is logged (message
// only, never tokens or client state) and reported via the return value.
async function tryDeleteImage(objectPath: string | null): Promise<boolean> {
  if (!objectPath) {
    return true;
  }

  try {
    await deleteImage(objectPath);
    return true;
  } catch (error) {
    console.error(
      `Failed to delete stored image "${objectPath}":`,
      error instanceof Error ? error.message : "unknown error"
    );
    return false;
  }
}

export async function createRecipeAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const parsed = parseRecipeInput(formData);

  if (!parsed.ok) {
    redirect(`/admin/recipes?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive) — the same helper the
  // live availability feedback queries, so the two can never disagree.
  if (await isRecipeNameTaken(prisma, parsed.value.name)) {
    redirect("/admin/recipes?error=duplicate_name");
  }

  // Every submitted relation ID is verified server-side before the write —
  // never trusted from the form alone. The same lookups double as the data
  // needed to revalidate the affected public routes below.
  const resultingItem = await prisma.item.findUnique({
    where: { id: parsed.value.resultingItemId },
  });

  if (!resultingItem) {
    redirect("/admin/recipes?error=invalid_resulting_item");
  }

  let profession = null;

  if (parsed.value.professionId) {
    profession = await prisma.profession.findUnique({
      where: { id: parsed.value.professionId },
    });

    if (!profession) {
      redirect("/admin/recipes?error=invalid_profession");
    }
  }

  const ingredientItemIds = parsed.value.ingredients.map(
    (ingredient) => ingredient.itemId
  );
  const ingredientItems = await prisma.item.findMany({
    where: { id: { in: ingredientItemIds } },
  });

  if (ingredientItems.length !== ingredientItemIds.length) {
    redirect("/admin/recipes?error=invalid_ingredient_item");
  }

  // The optional image is uploaded only after every field and relation
  // validation has passed, so a rejected submission never leaves an
  // orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/recipes?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("recipes", imageFile);
    } catch {
      redirect("/admin/recipes?error=upload_failed");
    }
  }

  try {
    // A single nested create: Prisma performs the Recipe insert and all
    // RecipeIngredient inserts as one atomic operation, so a failure on any
    // ingredient row leaves no partially-created Recipe behind.
    await prisma.recipe.create({
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        image: imagePath,
        resultingItemId: parsed.value.resultingItemId,
        resultingQuantity: parsed.value.resultingQuantity,
        professionId: parsed.value.professionId,
        requiredLevel: parsed.value.requiredLevel,
        ingredients: {
          create: parsed.value.ingredients.map((ingredient) => ({
            itemId: ingredient.itemId,
            quantity: ingredient.quantity,
          })),
        },
      },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

    if (isUniqueConstraintError(error)) {
      redirect("/admin/recipes?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/admin/recipes");
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${parsed.value.slug}`);
  revalidatePath(`/items/${resultingItem.slug}`);
  for (const item of ingredientItems) {
    revalidatePath(`/items/${item.slug}`);
  }
  if (profession) {
    revalidatePath(`/professions/${profession.slug}`);
  }

  redirect("/admin/recipes?success=created");
}

export async function updateRecipeAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug ? `/admin/recipes/${originalSlug}/edit` : null;

  if (!id) {
    redirect("/admin/recipes?error=missing_recipe");
  }

  const parsed = parseRecipeInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/recipes"}?error=${parsed.error}`);
  }

  // Loaded from the database, not trusted from the client, so we know the
  // recipe's previous relations (for revalidation) even if the form's
  // hidden fields were tampered with or are stale.
  const existingRecipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      resultingItem: true,
      profession: true,
      ingredients: { include: { item: true } },
    },
  });

  if (!existingRecipe) {
    redirect("/admin/recipes?error=missing_recipe");
  }

  // Shared duplicate rule (trimmed, case-insensitive), excluding this very
  // record so it never conflicts with itself — the same helper the live
  // availability feedback queries, so the two can never disagree.
  const existingByName = await isRecipeNameTaken(
    prisma,
    parsed.value.name,
    id
  );

  if (existingByName) {
    redirect(`${editPath ?? "/admin/recipes"}?error=duplicate_name`);
  }

  // Every submitted relation ID is verified server-side before the write —
  // never trusted from the form alone. The same lookups double as the data
  // needed to revalidate the new side of each relation below.
  const resultingItem = await prisma.item.findUnique({
    where: { id: parsed.value.resultingItemId },
  });

  if (!resultingItem) {
    redirect(`${editPath ?? "/admin/recipes"}?error=invalid_resulting_item`);
  }

  let profession = null;

  if (parsed.value.professionId) {
    profession = await prisma.profession.findUnique({
      where: { id: parsed.value.professionId },
    });

    if (!profession) {
      redirect(`${editPath ?? "/admin/recipes"}?error=invalid_profession`);
    }
  }

  const ingredientItemIds = parsed.value.ingredients.map(
    (ingredient) => ingredient.itemId
  );
  const ingredientItems = await prisma.item.findMany({
    where: { id: { in: ingredientItemIds } },
  });

  if (ingredientItems.length !== ingredientItemIds.length) {
    redirect(`${editPath ?? "/admin/recipes"}?error=invalid_ingredient_item`);
  }

  // The image intent comes from the submission, but the existing stored
  // path only ever comes from the database record loaded above — a
  // client-supplied path is never trusted to target a storage operation.
  const existingImagePath = existingRecipe.image;
  const imageFile = getSubmittedImageFile(formData);
  const removeImage = formData.get("removeImage") === "on";

  if (imageFile && removeImage) {
    redirect(`${editPath ?? "/admin/recipes"}?error=conflicting_image_input`);
  }

  // Uploaded only after every field and relation validation has passed, so
  // a rejected submission never leaves an orphaned file behind.
  let newImagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(
        `${editPath ?? "/admin/recipes"}?error=${imageValidation.error}`
      );
    }

    try {
      newImagePath = await uploadImage("recipes", imageFile);
    } catch {
      redirect(`${editPath ?? "/admin/recipes"}?error=upload_failed`);
    }
  }

  // Replacement stores the new path, removal clears it, and an untouched
  // image control keeps the existing stored path.
  const imageValue = newImagePath ?? (removeImage ? null : existingImagePath);

  try {
    // Update the Recipe, delete all of its existing ingredient rows, then
    // recreate the submitted set — all as one atomic transaction, so the
    // Recipe is never left with zero or partially-updated ingredients if
    // any step fails.
    await prisma.$transaction([
      prisma.recipe.update({
        where: { id },
        data: {
          name: parsed.value.name,
          slug: parsed.value.slug,
          image: imageValue,
          resultingItemId: parsed.value.resultingItemId,
          resultingQuantity: parsed.value.resultingQuantity,
          professionId: parsed.value.professionId,
          requiredLevel: parsed.value.requiredLevel,
        },
      }),
      prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
      prisma.recipeIngredient.createMany({
        data: parsed.value.ingredients.map((ingredient) => ({
          recipeId: id,
          itemId: ingredient.itemId,
          quantity: ingredient.quantity,
        })),
      }),
    ]);
  } catch (error) {
    // The database still references the old image (or none), so the file
    // just uploaded for this failed update must not linger in storage.
    await tryDeleteImage(newImagePath);

    if (isUniqueConstraintError(error)) {
      redirect(`${editPath ?? "/admin/recipes"}?error=duplicate`);
    }
    if (isMissingRecordError(error)) {
      redirect("/admin/recipes?error=missing_recipe");
    }
    if (isForeignKeyError(error)) {
      // A relation (resulting item, profession, or an ingredient item) was
      // removed between validation and the write; treat it the same as a
      // normal invalid-relation error rather than crashing.
      redirect(`${editPath ?? "/admin/recipes"}?error=relation_changed`);
    }
    throw error;
  }

  // Only after the transaction has succeeded is the old file deleted. If
  // this cleanup fails, the update stays successful — an orphaned file is
  // less harmful than rolling the record back to a deleted path — and the
  // admin gets a distinct success message noting the leftover file.
  let oldImageCleanupFailed = false;

  if ((newImagePath !== null || removeImage) && existingImagePath) {
    oldImageCleanupFailed = !(await tryDeleteImage(existingImagePath));
  }

  revalidatePath("/admin/recipes");
  if (editPath) {
    revalidatePath(editPath);
  }
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${existingRecipe.slug}`);
  if (parsed.value.slug !== existingRecipe.slug) {
    revalidatePath(`/recipes/${parsed.value.slug}`);
  }

  const itemSlugsToRevalidate = new Set<string>([
    existingRecipe.resultingItem.slug,
    resultingItem.slug,
    ...existingRecipe.ingredients.map((ingredient) => ingredient.item.slug),
    ...ingredientItems.map((item) => item.slug),
  ]);
  for (const itemSlug of itemSlugsToRevalidate) {
    revalidatePath(`/items/${itemSlug}`);
  }

  const professionSlugsToRevalidate = new Set<string>();
  if (existingRecipe.profession) {
    professionSlugsToRevalidate.add(existingRecipe.profession.slug);
  }
  if (profession) {
    professionSlugsToRevalidate.add(profession.slug);
  }
  for (const professionSlug of professionSlugsToRevalidate) {
    revalidatePath(`/professions/${professionSlug}`);
  }

  redirect(
    oldImageCleanupFailed
      ? "/admin/recipes?success=updated_image_cleanup"
      : "/admin/recipes?success=updated"
  );
}

export async function deleteRecipeAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const confirmPath = slug ? `/admin/recipes/${slug}/delete` : "/admin/recipes";

  if (!id) {
    redirect("/admin/recipes?error=missing_recipe");
  }

  // Loaded fresh from the database, not trusted from the client, so we know
  // the recipe's actual relations for revalidation even if the confirmation
  // form's hidden fields were tampered with or are stale.
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      resultingItem: true,
      profession: true,
      ingredients: { include: { item: true } },
    },
  });

  if (!recipe) {
    redirect("/admin/recipes?error=missing_recipe");
  }

  try {
    // RecipeIngredient rows are removed automatically via the
    // `onDelete: Cascade` relation defined on RecipeIngredient.recipe in
    // prisma/schema.prisma. The resulting Item, ingredient Items, and
    // Profession are never touched by this delete — nothing else in the
    // schema references a Recipe by foreign key, so there is no linked-data
    // condition to block on here.
    await prisma.recipe.delete({ where: { id } });
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/recipes?error=missing_recipe");
    }
    throw error;
  }

  // Only after the database deletion has succeeded is the stored image
  // removed — database first, so a blocked or failed delete never strands
  // a surviving record pointing at a missing file. The path comes from the
  // trusted record loaded above, never from the client. If this cleanup
  // fails, the deletion stays successful and the admin gets a distinct
  // success message noting the leftover file.
  const imageCleanupFailed = !(await tryDeleteImage(recipe.image));

  revalidatePath("/admin/recipes");
  revalidatePath(confirmPath);
  revalidatePath(`/admin/recipes/${recipe.slug}/edit`);
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipe.slug}`);

  const itemSlugsToRevalidate = new Set<string>([
    recipe.resultingItem.slug,
    ...recipe.ingredients.map((ingredient) => ingredient.item.slug),
  ]);
  for (const itemSlug of itemSlugsToRevalidate) {
    revalidatePath(`/items/${itemSlug}`);
  }

  if (recipe.profession) {
    revalidatePath(`/professions/${recipe.profession.slug}`);
  }

  redirect(
    imageCleanupFailed
      ? "/admin/recipes?success=deleted_image_cleanup"
      : "/admin/recipes?success=deleted"
  );
}
