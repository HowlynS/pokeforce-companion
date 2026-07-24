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
import {
  RECIPE_INGREDIENT_ROW_COUNT,
  parseRecipeGeneralInput,
  parseRecipeIngredientsInput,
  parseRecipeInput,
} from "@/lib/validation/recipe";
import { isRecipeNameTaken } from "@/lib/admin/record-name";
import { resolveVerificationStamp } from "@/lib/game-versions";
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
    redirect(`/admin/recipes/new?error=${parsed.error}`);
  }

  // Shared duplicate rule (trimmed, case-insensitive) — the same helper the
  // live availability feedback queries, so the two can never disagree.
  if (await isRecipeNameTaken(prisma, parsed.value.name)) {
    redirect("/admin/recipes/new?error=duplicate_name");
  }

  // Every submitted relation ID is verified server-side before the write —
  // never trusted from the form alone. The same lookups double as the data
  // needed to revalidate the affected public routes below.
  const resultingItem = await prisma.item.findUnique({
    where: { id: parsed.value.resultingItemId },
  });

  if (!resultingItem) {
    redirect("/admin/recipes/new?error=invalid_resulting_item");
  }

  let profession = null;

  if (parsed.value.professionId) {
    profession = await prisma.profession.findUnique({
      where: { id: parsed.value.professionId },
    });

    if (!profession) {
      redirect("/admin/recipes/new?error=invalid_profession");
    }
  }

  const ingredientItemIds = parsed.value.ingredients.map(
    (ingredient) => ingredient.itemId
  );
  const ingredientItems = await prisma.item.findMany({
    where: { id: { in: ingredientItemIds } },
  });

  if (ingredientItems.length !== ingredientItemIds.length) {
    redirect("/admin/recipes/new?error=invalid_ingredient_item");
  }

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`/admin/recipes/new?error=${verification.error}`);
  }

  // The optional image is uploaded only after every field and relation
  // validation has passed, so a rejected submission never leaves an
  // orphaned file behind.
  const imageFile = getSubmittedImageFile(formData);
  let imagePath: string | null = null;

  if (imageFile) {
    const imageValidation = validateImageFile(imageFile);

    if (!imageValidation.ok) {
      redirect(`/admin/recipes/new?error=${imageValidation.error}`);
    }

    try {
      imagePath = await uploadImage("recipes", imageFile);
    } catch {
      redirect("/admin/recipes/new?error=upload_failed");
    }
  }

  let createdRecipe;

  try {
    // A single nested create: Prisma performs the Recipe insert and all
    // RecipeIngredient inserts as one atomic operation, so a failure on any
    // ingredient row leaves no partially-created Recipe behind.
    createdRecipe = await prisma.recipe.create({
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        image: imagePath,
        resultingItemId: parsed.value.resultingItemId,
        resultQuantityMin: parsed.value.resultQuantityMin,
        resultQuantityMax: parsed.value.resultQuantityMax,
        professionId: parsed.value.professionId,
        requiredLevel: parsed.value.requiredLevel,
        ingredients: {
          create: parsed.value.ingredients.map((ingredient) => ({
            itemId: ingredient.itemId,
            quantity: ingredient.quantity,
          })),
        },
        // Without the opt-in stamp both verification fields stay NULL — a
        // newly created recipe is unverified by default.
        ...(verification.stamp ?? {}),
      },
    });
  } catch (error) {
    // The row was never created, so the file just uploaded for it must not
    // linger in storage. The user still sees the database outcome below.
    await tryDeleteImage(imagePath);

    if (isUniqueConstraintError(error)) {
      redirect("/admin/recipes/new?error=duplicate");
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

  // Admin Polish Pass 2, Part 2: straight to the new record's own
  // canonical editor, using the ACTUAL persisted slug from the created
  // row — never parsed.value.slug reconstructed independently.
  redirect(`/admin/recipes/${createdRecipe.slug}/edit?success=recipe_created`);
}

// The General editor's own action (Slice 9C.3): every Recipe field EXCEPT
// ingredients, which now belong to the separate Ingredients tab and its
// own action below. Never touches the RecipeIngredient table, so General
// stays fully editable regardless of how many ingredient rows the recipe
// carries — the ingredient-count capacity guard applies to the
// Ingredients tab only.
export async function updateRecipeGeneralAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const editPath = originalSlug ? `/admin/recipes/${originalSlug}/edit` : null;

  if (!id) {
    redirect("/admin/recipes?error=missing_recipe");
  }

  const parsed = parseRecipeGeneralInput(formData);

  if (!parsed.ok) {
    redirect(`${editPath ?? "/admin/recipes"}?error=${parsed.error}`);
  }

  // Loaded from the database, not trusted from the client, so we know the
  // recipe's previous relations (for revalidation) even if the form's
  // hidden fields were tampered with or are stale.
  const existingRecipe = await prisma.recipe.findUnique({
    where: { id },
    include: { resultingItem: true, profession: true },
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

  // Resolved before any upload so a missing current Game Version rejects
  // the submission without leaving an orphaned file behind. The shared
  // helper stamps the server's own clock and the database row marked
  // current when the form supplies no selection, or a server-validated
  // explicitly selected version — a nonexistent or tampered id fails
  // the submission.
  const verification = await resolveVerificationStamp(prisma, formData);

  if (verification.failed) {
    redirect(`${editPath ?? "/admin/recipes"}?error=${verification.error}`);
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
    // A single update — no ingredient rows are touched, so a Recipe's
    // ingredients (however many it carries, even beyond editor capacity)
    // are never at risk from a General save.
    await prisma.recipe.update({
      where: { id },
      data: {
        name: parsed.value.name,
        slug: parsed.value.slug,
        image: imageValue,
        resultingItemId: parsed.value.resultingItemId,
        resultQuantityMin: parsed.value.resultQuantityMin,
        resultQuantityMax: parsed.value.resultQuantityMax,
        professionId: parsed.value.professionId,
        requiredLevel: parsed.value.requiredLevel,
        // Verification fields are included ONLY when the opt-in checkbox
        // was checked — a normal edit never alters or clears existing
        // verification metadata, because Prisma leaves omitted fields
        // untouched.
        ...(verification.stamp ?? {}),
      },
    });
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
      // A relation (resulting item or profession) was removed between
      // validation and the write; treat it the same as a normal
      // invalid-relation error rather than crashing.
      redirect(`${editPath ?? "/admin/recipes"}?error=relation_changed`);
    }
    throw error;
  }

  // Only after the update has succeeded is the old file deleted. If this
  // cleanup fails, the update stays successful — an orphaned file is less
  // harmful than rolling the record back to a deleted path — and the
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

  // Admin Polish Pass 2, Part 1: back to the SAME canonical editor —
  // deliberately built from parsed.value.slug (the slug just PERSISTED),
  // never editPath's own originalSlug: if this very save also renamed the
  // recipe, originalSlug's URL would 404 against the now-current row.
  // Every error redirect above still correctly uses editPath/originalSlug,
  // since on an error nothing was written and the record's real slug is
  // still whatever originalSlug says.
  redirect(
    oldImageCleanupFailed
      ? `/admin/recipes/${parsed.value.slug}/edit?success=recipe_saved_image_cleanup`
      : `/admin/recipes/${parsed.value.slug}/edit?success=recipe_saved`
  );
}

// The Ingredients tab's own action (Slice 9C.3): touches ONLY the
// RecipeIngredient rows — name, slug, resulting item, profession,
// required level, image, and verification metadata are never read from
// the submission and never written here, so a normal ingredient save
// leaves every other Recipe field byte-for-byte unchanged.
export async function updateRecipeIngredientsAction(formData: FormData) {
  // Repeated here deliberately: every mutation re-checks authorization and
  // never relies solely on the admin layout having already run.
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const ingredientsPath = originalSlug
    ? `/admin/recipes/${originalSlug}/ingredients`
    : null;

  if (!id) {
    redirect("/admin/recipes?error=missing_recipe");
  }

  // Loaded from the database, not trusted from the client, so we know the
  // recipe's previous ingredients (for revalidation and the capacity
  // guard below) even if the form's hidden fields were tampered with.
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

  // Defense in depth: the Ingredients form is only ever rendered for a
  // recipe within editor capacity. A request that somehow reaches this
  // action for an over-capacity recipe must never truncate it down to
  // the form's fixed row count — the same guarantee the page's own
  // safety state provides, enforced again here against direct tampering.
  if (existingRecipe.ingredients.length > RECIPE_INGREDIENT_ROW_COUNT) {
    redirect(
      `${ingredientsPath ?? "/admin/recipes"}?error=too_many_ingredients`
    );
  }

  const parsed = parseRecipeIngredientsInput(formData);

  if (!parsed.ok) {
    redirect(`${ingredientsPath ?? "/admin/recipes"}?error=${parsed.error}`);
  }

  // Every submitted ingredient item ID is verified server-side before the
  // write — never trusted from the form alone.
  const ingredientItemIds = parsed.value.ingredients.map(
    (ingredient) => ingredient.itemId
  );
  const ingredientItems = await prisma.item.findMany({
    where: { id: { in: ingredientItemIds } },
  });

  if (ingredientItems.length !== ingredientItemIds.length) {
    redirect(
      `${ingredientsPath ?? "/admin/recipes"}?error=invalid_ingredient_item`
    );
  }

  try {
    // Delete the existing ingredient rows, then recreate the submitted
    // set, as one atomic transaction — the Recipe is never left with
    // zero or partially-updated ingredients if any step fails. The
    // trailing recipe.update (Admin Polish Pass 2) touches ONLY
    // updatedAt, in the SAME transaction: ingredients are part of a
    // recipe's own content, so a change to them should bump the
    // recipe's own timestamp too, and doing so here — rather than a
    // second, separate write — is what lets the Ingredients page use
    // the recipe's own updatedAt as its save-in-place remount key,
    // exactly like every other editor tab, with no bespoke nonce needed.
    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: id } }),
      prisma.recipeIngredient.createMany({
        data: parsed.value.ingredients.map((ingredient) => ({
          recipeId: id,
          itemId: ingredient.itemId,
          quantity: ingredient.quantity,
        })),
      }),
      prisma.recipe.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
  } catch (error) {
    if (isMissingRecordError(error)) {
      redirect("/admin/recipes?error=missing_recipe");
    }
    if (isForeignKeyError(error)) {
      // An ingredient item was removed between validation and the write;
      // treat it the same as a normal invalid-relation error rather than
      // crashing.
      redirect(
        `${ingredientsPath ?? "/admin/recipes"}?error=relation_changed`
      );
    }
    throw error;
  }

  revalidatePath("/admin/recipes");
  if (ingredientsPath) {
    revalidatePath(ingredientsPath);
  }
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${existingRecipe.slug}`);

  const itemSlugsToRevalidate = new Set<string>([
    existingRecipe.resultingItem.slug,
    ...existingRecipe.ingredients.map((ingredient) => ingredient.item.slug),
    ...ingredientItems.map((item) => item.slug),
  ]);
  for (const itemSlug of itemSlugsToRevalidate) {
    revalidatePath(`/items/${itemSlug}`);
  }

  if (existingRecipe.profession) {
    revalidatePath(`/professions/${existingRecipe.profession.slug}`);
  }

  // Admin Polish Pass 2, Part 1: back to the SAME canonical Ingredients
  // tab URL (never the list) so a save keeps the contributor where they
  // were.
  redirect(`${ingredientsPath ?? "/admin/recipes"}?success=ingredients_saved`);
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
      ? "/admin/recipes?success=recipe_deleted_image_cleanup"
      : "/admin/recipes?success=recipe_deleted"
  );
}
