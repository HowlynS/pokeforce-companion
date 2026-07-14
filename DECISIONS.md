# PokeForce Companion — Decision Log

This file tracks important technical and product decisions.

## Decision Format

Each decision should include:

- Date
- Decision
- Reason
- Alternatives considered, if relevant

---

## Decisions

### 2026-07-10 — Repository name

Decision:

Use `pokeforce-companion` as the GitHub repository and local project name.

Reason:

The name is lowercase, clear, URL-safe, and matches the project identity.

---

### 2026-07-10 — Package manager

Decision:

Use `pnpm`.

Reason:

The project uses a modern JavaScript/TypeScript stack, and pnpm is fast, clean, and reliable for dependency management.

---

### 2026-07-10 — AI workflow

Decision:

Use ChatGPT for guided milestone planning and Claude Code for local code assistance.

Reason:

ChatGPT keeps the beginner-friendly step-by-step workflow controlled, while Claude Code can help edit files locally when development begins.

---

### 2026-07-11 — Milestone 5 authentication and authorization approach

Decision:

Use Supabase Auth with email/password sign-in only. There is no public
sign-up page; the single administrator account is created manually in the
Supabase dashboard. Authorization is a single authorized email compared
against a server-only `ADMIN_EMAIL` environment variable — there is no
Prisma `User`/role model and no database migration for this. Use
`@supabase/supabase-js` and `@supabase/ssr`, with the anon key only (no
service-role key). Middleware only refreshes the Supabase session cookie; it
is not the authorization boundary. The `/admin` layout performs its own
server-side check (redirect to `/login` if unauthenticated, deny if the
email does not match `ADMIN_EMAIL`), and future write operations must repeat
this same server-side check rather than relying on the layout alone.

Reason:

Keeps the first admin slice minimal and matches the single-owner nature of
the project: one authorized editor, no self-service accounts, no new
database schema. Checking authorization on the server (not just hiding UI)
protects write operations even if a client-side check is bypassed.

Alternatives considered:

- A Prisma-backed `User`/role table — rejected for this slice as unnecessary
  scope; revisit only if multiple admins are needed later.
- Supabase service-role key for admin checks — rejected; the anon key with a
  server-side `auth.getUser()` call is sufficient and keeps the powerful
  service-role key out of the app entirely.

---

### 2026-07-11 — Admin mutation pattern (established with Category create)

Decision:

Authenticated game-data writes are plain Next.js Server Actions colocated
with the admin route that uses them (e.g. `src/app/admin/categories/actions.ts`).
Every mutation calls `requireAdminUser()` itself at the top of the action,
even though the admin layout already gates the route — the layout is not
trusted as the sole authorization boundary. Input validation is done with
small hand-written helpers local to the resource (e.g.
`src/lib/validation/category.ts`), not a validation library. Known Prisma
errors (unique constraint violations) are caught and converted into a plain
`?error=duplicate` redirect message; no raw database error is ever rendered.
Successful writes call `revalidatePath()` for both the admin list and the
corresponding public route, then redirect back with a `?success=` message.
Update actions (added with Category edit) locate and mutate the target row
by its stable `id`, never by the editable `slug` — the slug is only ever
used to build the edit page's URL, so changing it in the same submission
cannot cause the action to lose or miss the record.

Reason:

Establishes one small, repeatable pattern for the remaining Milestone 5
resources (items, professions, recipes) instead of each one inventing its
own shape. Repeating the authorization check per-action protects future
mutations even if a route is ever nested or reorganized in a way that
weakens the layout's coverage.

Alternatives considered:

- Zod (or another validation library) — rejected for now; the fields
  involved (name, slug, optional description) are simple enough that hand
  validation is clearer and avoids adding a package before it's justified.

---

### 2026-07-11 — Admin deletion pattern (established with Category delete)

Decision:

Destructive admin actions get a dedicated server-rendered confirmation route
(e.g. `/admin/categories/[slug]/delete`), not a client-side `confirm()`
dialog. The confirmation page independently queries the record and its
linked-item count on every load and omits the final delete button entirely
when deletion isn't allowed. The delete server action re-checks that same
linked-item count itself immediately before deleting — the page's disabled
button is a UX convenience, not the enforcement point. A category with one
or more linked items cannot be deleted; the application does not fall back
to `SET NULL` on those items even though the schema's optional relation
would otherwise permit it. Items must be reassigned manually (in a future
item-editing slice) before their category can be removed.

Reason:

Keeps deletion recoverable-by-design: a confirmation step that reflects live
data (not a stale count baked into a link) and a server check that can't be
bypassed by skipping the UI. Preserving linked categories avoids silently
orphaning item data before the admin interface can manage items directly.

Alternatives considered:

- Relying on the database's `SET NULL` default and letting deletion proceed
  — rejected; it would silently detach items from their category with no
  admin-visible warning, which this milestone's scope treats as unsafe until
  item editing exists.
- A soft-delete flag — rejected as unrequested scope for this slice.

---

### 2026-07-11 — Server-side validation of submitted relation IDs (established with Item create)

Decision:

When a create/update form lets the admin pick a related record (e.g. an
Item's optional Category) via a `<select>`, the submitted ID is never
trusted as-is. The server action looks it up with Prisma before using it in
the mutation; if a non-empty submitted ID doesn't correspond to an existing
row, the action redirects with a readable error (e.g. `invalid_category`)
instead of letting the database reject it or silently writing a dangling
foreign key. The interface itself always displays the related record's name
(e.g. Category name), never its raw ID.

Reason:

A `<select>` value is still just a client-supplied string — a stale option,
a modified request, or a record deleted between page load and submission
could all produce an ID that no longer exists. Verifying it server-side
before the write keeps the same "never trust client input for anything
that authorizes or targets a mutation" posture already established for
authorization and stable-ID lookups, extended to relation fields now that
Item is the first resource with one.

Alternatives considered:

- Trusting the submitted ID and letting Prisma's foreign-key constraint
  reject it — rejected; that would surface a raw database error instead of
  the readable feedback this project requires.

---

### 2026-07-11 — Revalidating both sides of a changed relation (established with Item edit)

Decision:

When an update can change which related record something belongs to (e.g.
reassigning an Item to a different Category, or removing the Category
entirely), the update action loads the row's *current* relation from the
database at the start of the action — not from a client-supplied hidden
field — and uses that to revalidate the former relation-owner's public
route in addition to the newly assigned one. Both `/categories` (the list)
and the specific old and new `/categories/[slug]` detail routes are
revalidated when they differ.

Reason:

A hidden form field describing "the category this item used to belong to"
would just be client-supplied context, no more trustworthy than the
submitted relation ID itself, and could be stale or tampered with. Reading
the prior relation from the database guarantees the revalidation targets
the routes that actually displayed the item before the change, so moving an
item between categories (or clearing its category) is reflected on both
the old and new public pages without a restart.

Alternatives considered:

- Deriving the "old" category from a hidden form field — rejected for the
  same reason submitted relation IDs aren't trusted for the mutation itself:
  it's client-supplied and can be stale.

---

### 2026-07-11 — Checking multiple relation paths before deletion (established with Item delete)

Decision:

When a record can be referenced through more than one relation, the delete
action checks every relevant relation path server-side immediately before
deleting, and blocks if any of them is non-zero. Item deletion checks both
`_count.recipesProduced` (used as a recipe's result) and
`_count.recipeIngredients` (used as an ingredient) — either one alone is
enough to block deletion. The confirmation page shows both counts
individually so the reason is clear, and the blocked-deletion message
names which relation(s) are actually populated (result, ingredient, or
both) rather than a single generic "in use" message.

Reason:

Category and Profession each had exactly one relation to check (items,
recipes). Item is the first resource referenced through two independent
relations, and a real record can be blocked by either, both, or neither —
collapsing that into one boolean would hide which reference is actually
the obstacle. Checking both explicitly keeps the same "the DB's `RESTRICT`
behavior is a backstop, not the explanation" posture already established:
the admin interface proactively explains why, rather than surfacing a raw
foreign-key error.

Alternatives considered:

- Checking only one relation (e.g. ingredient use) and letting the other
  surface as a raw Prisma foreign-key error — rejected; it would violate the
  established rule that no raw database error reaches the user.

---

### 2026-07-11 — Multi-row relational writes (established with Recipe create)

Decision:

Recipe is the first resource whose create action writes more than one
relation at a time (the Recipe plus one row per ingredient). This is done
as a single nested Prisma `create` — `prisma.recipe.create({ data: {
..., ingredients: { create: [...] } } })` — rather than a manual loop of
separate inserts, so Prisma performs the whole write as one atomic
operation with no explicit `$transaction` needed. Every ingredient's
`itemId`, plus the resulting Item ID and any Profession ID, are verified to
exist server-side (via `findUnique`/`findMany`) before that write runs — a
`<select>` value is still just a client-supplied string, per the rule
already established for Item's Category relation. Duplicate ingredient
Items in the same submission are rejected with a readable message rather
than merging their quantities, since no existing behavior in the codebase
defines what merging should mean.

Reason:

A partially-created Recipe (saved but missing some ingredients because one
insert failed) would be a worse failure mode than rejecting the whole
submission, so atomicity matters here more than for single-row resources.
Verifying every relation ID up front, before the write, keeps errors
readable instead of surfacing a raw foreign-key failure partway through a
multi-row insert.

Alternatives considered:

- A manual loop creating each `RecipeIngredient` in a separate `prisma.*.create`
  call after the Recipe — rejected; without wrapping in `$transaction` it
  risks a Recipe with partial ingredients on failure, and the nested create
  achieves the same atomicity with less code.
- Silently deduplicating or summing quantities for a repeated ingredient
  Item — rejected as invented behavior; the project defines no such rule,
  so the safer default is to reject and ask the admin to fix the input.

---

### 2026-07-11 — Atomically replacing child rows on a relational edit (established with Recipe edit)

Decision:

When editing a resource whose child rows (RecipeIngredient) can be
entirely replaced rather than merged, the update action wraps three steps
in one `prisma.$transaction([...])`: update the parent Recipe's own
fields, `deleteMany` all of its existing ingredient rows, then
`createMany` the submitted set. All three succeed or none do. The action
loads the Recipe's current relations (resulting Item, Profession,
ingredient Items) from the database before the transaction — never from
client-supplied hidden fields — so it knows the true "before" state for
revalidating every affected public route, on top of the "after" state
confirmed by the relation-ID verification queries.

Reason:

A nested `create` (used for Recipe's initial creation) has no equivalent
nested "replace this relation set" operation in Prisma — the only way to
swap out a full set of child rows is delete-then-recreate. Doing that
outside a transaction risks leaving a Recipe with zero ingredients if the
process is interrupted between the delete and the recreate. Wrapping both
steps (plus the parent update) in `$transaction` extends the same
atomicity guarantee already established for Recipe's create to its edit
path.

Alternatives considered:

- Diffing old vs. new ingredients and issuing individual `update`/`create`/
  `delete` calls per row — rejected as unnecessary complexity for a fixed,
  small row count; delete-all-and-recreate inside one transaction is simpler
  and equally safe.

---

### 2026-07-11 — Relying on a confirmed schema cascade instead of an app-level block (established with Recipe delete)

Decision:

Category, Profession, and Item deletion all block when another resource
still references them, because those relations are ordinary foreign keys
pointing at rows that must survive independently. Recipe is different:
`RecipeIngredient.recipe` is declared `onDelete: Cascade` in
`prisma/schema.prisma`, and a RecipeIngredient row has no meaning without
its parent Recipe — it is a join/detail row owned exclusively by the
Recipe, not an independent resource. After confirming that cascade in the
schema (and confirming nothing else in the schema references a Recipe by
foreign key), Recipe deletion is a plain `prisma.recipe.delete({ where: {
id } })` with no app-level linked-row count or blocking condition — the
database cascade is trusted directly instead of being re-implemented as an
admin-side check.

Reason:

Building an app-level "block if it has ingredients" check would be both
redundant with the schema's own guarantee and actively wrong: an admin
should be able to delete a Recipe and have its ingredient list disappear
with it, unlike deleting a Category that still has Items. The distinction
that matters is whether the child relation is an owned detail row (safe to
cascade) or an independent resource (must be preserved) — this is the
first destructive action in the milestone where that answer is "cascade is
correct," and it was verified by reading the schema, not assumed.

Alternatives considered:

- Manually deleting RecipeIngredient rows before deleting the Recipe (mirroring
  the update action's delete-then-recreate) — rejected as redundant; the
  schema's own cascade already guarantees this atomically at the database
  level, and duplicating it in application code would just be more surface
  area for the two to drift out of sync.

---

### 2026-07-11 — Milestone 5 scope boundary

Decision:

Image upload/storage for items, recipes, and professions is left out of
every Milestone 5 admin form entirely (no `image` field is exposed anywhere,
even though it exists on the Item/Profession models) rather than being
added as a disabled or placeholder control. Live duplicate-name checking
while typing and final visual/mock-up-based redesign are also left out —
every admin page uses the existing hand-written design-token styling and
validates duplicates only on submit. These are explicitly Milestone 6 and
Milestone 7 concerns respectively.

Reason:

Keeps Milestone 5 scoped to server-side protected editing only, matching
`AI_RULES.md`'s instruction not to introduce features before their
milestone. Adding a half-wired image field or live-validation UI now would
create work that Milestone 6/7 would need to either finish or undo.

Alternatives considered:

- Adding the `image` field to forms now but leaving upload unimplemented —
  rejected; a field with nowhere to put a real value is worse than no field.

---

### 2026-07-13 — Milestone 6 image and storage architecture

Decision:

Milestone 6 adds image support for Items, Recipes, and Professions only —
Categories are not included. Each supported record has exactly one optional
image. Recipes get their own independent optional image field: a Recipe's
image is never inferred from or permanently coupled to its resulting Item's
image. The future Recipe field matches the existing Item and Profession
pattern (`image String?`), which means a later slice will need an additive
Prisma migration for Recipe. That migration is not created in this
documentation slice.

Storage provider is Supabase Storage, with a single bucket named
`game-images`. The bucket is publicly readable, because the public content
pages are accessible without authentication. All write operations (upload,
replace, remove, delete) remain protected: Milestone 6 reuses the
Milestone 5 authentication and authorization architecture unchanged — the
Supabase authenticated session with the anon key only, no service-role key
— and every server action that uploads, replaces, removes, or deletes an
image calls the existing `requireAdminUser()` itself, per the established
admin mutation pattern (the protected admin layout is not sufficient
authorization for mutations). Supabase Storage policies must prevent
anonymous writes and should restrict write operations to the authenticated
admin account as tightly as is practical with the existing architecture;
the exact SQL policy implementation is handled in a later storage-setup
slice.

Database image fields store the Supabase Storage object path (for example
`items/<generated-unique-name>.png`,
`recipes/<generated-unique-name>.webp`,
`professions/<generated-unique-name>.jpg`), never a full public URL.
Public URLs are derived from the stored path by application code, so
records are not permanently coupled to one Supabase project URL. Object
names are always generated server-side — a client-supplied filename is
never trusted or directly reused as the storage object name — grouped by
resource type (`items/`, `recipes/`, `professions/`), and every upload
gets a new unique path rather than overwriting an existing one. This
reduces stale CDN cache problems and filename conflicts.

Accepted image types are PNG, JPEG, and WebP; SVG uploads are not allowed.
The maximum file size is 5 MB. Both file type and size are validated
server-side; a client-side `accept` attribute may be used for convenience
but is not a security boundary.

Admin create forms support an optional image upload. Admin edit forms
display the current image and let the admin upload a replacement,
explicitly remove the current image, or leave it unchanged. Replacement
follows this order: (1) validate the new file, (2) upload it to a new
unique storage path, (3) update the database record to reference the new
path, (4) if the database update fails, attempt to delete the newly
uploaded file, (5) delete the old stored file only after the database
update succeeds. The old file is never overwritten in place. When a
supported database record is deleted, its associated image should also be
removed from Supabase Storage; because the database and Storage cannot
share one transaction, that cleanup must be defensive and must never
expose a raw storage or database error — the exact delete ordering and
user-facing failure handling are finalized during the implementation slice
that updates the delete actions. A client-supplied object path is never
trusted as authorization to delete or replace a file: the server
determines the existing stored image path from the database record before
any destructive storage operation. All storage mutations follow the
existing readable-error and redirect patterns; no raw Supabase, Storage,
Prisma, or database error is ever rendered.

Images are displayed on public browsing cards, public detail pages, and
admin edit forms (as a current-image preview). Admin list thumbnails are
not required unless later found necessary for a clear workflow. Records
without an uploaded image use a consistent fallback or placeholder system
with stable, predictable paths, and the application must continue
rendering correctly when no uploaded image exists — but no elaborate
placeholder artwork and no visual redesign are part of this milestone.
PokeForce artwork uses small 16-bit-style sprites, and display must
preserve that character: preserve the original aspect ratio, avoid
cropping sprites to fill containers, and avoid arbitrary large
enlargement. The surrounding layout may provide spacing and framing, but
sprites are not treated like large photographic assets.

Amended 2026-07-14: image display uses the browser's normal smooth
rendering by default. Universal `image-rendering: pixelated` was tried
and rejected because it degraded smooth artwork. No in-app upscaler will
be added. A per-image Smooth / Pixel art display option is deferred until
the approved real asset set is known. The project currently uses test
assets and placeholders while awaiting explicit permission from the game
owner to use game assets and descriptions.

The application is expected to use Next.js image handling where practical.
A later display slice may require Supabase Storage remote-image
configuration in `next.config.ts`, pixel-art-safe CSS, an explicit image
container size, and a server-action body-size configuration compatible
with the 5 MB upload limit. `next.config.ts` is not modified in this
documentation slice.

Out of scope for Milestone 6: Category images; automatic image resizing,
format conversion, or cropping; AI upscaling; image enhancement;
sprite-generation tools; multiple images per record; Milestone 7 search;
live duplicate-name validation; locations, NPCs, marketplace, or AI
features; deployment; final visual redesign; gameplay verification
metadata; Held item fields; and application build/version metadata.
Manually prepared or externally upscaled assets may still be uploaded
later as normal image files.

Reason:

A single publicly readable bucket matches how the content is consumed —
anonymous visitors browse the public pages, so image reads need no
authentication — while keeping every write behind the same server-side
`requireAdminUser()` boundary already protecting all game-data mutations.
Storing the object path instead of a full URL keeps records portable
across Supabase projects. Generating unique server-side object names
extends the established "never trust client input for anything that
authorizes or targets a mutation" posture to filenames and avoids CDN
staleness on replacement. Giving Recipes their own image field keeps the
three supported resources symmetric and avoids inventing a coupling rule
(recipe inherits its result's image) that no source-of-truth document
defines. The upload-then-update-then-clean-up replacement order accepts
that Storage and Postgres cannot share one transaction and chooses the
failure mode that never leaves a database record pointing at a missing
file — a temporary orphaned file is recoverable; a broken image reference
on a public page is user-visible.

Alternatives considered:

- A Supabase service-role key for storage writes — rejected again,
  consistent with the Milestone 5 decision; the authenticated admin
  session with storage policies is sufficient and keeps the service-role
  key out of the app entirely.
- Storing full public URLs in the database — rejected; it permanently
  couples every record to one Supabase project URL.
- Overwriting the existing object path on replacement — rejected; CDN
  caching can serve the stale file, and a failed overwrite could corrupt
  the only copy.
- Deriving a Recipe's image from its resulting Item — rejected; it
  couples two independent records and prevents distinct recipe artwork.
- Allowing SVG uploads — rejected; SVG is a script-capable format and is
  unnecessary for sprite-based assets.

---

### 2026-07-14 — Milestone 7 automated testing foundation and isolated test environment

Decision:

Automated testing is the first engineering slice of Milestone 7, before any
search or polish work changes existing behavior. What exists today: Vitest
(Node environment, no DOM library, no coverage dependency) runs service-free
unit tests covering the pure validation parsers, the image validation and
object-path logic, and the shared Prisma error guards — these tests load no
environment variables and touch no database, Supabase, or browser. Local,
reliable testing comes before CI: Playwright is planned Chromium-only for
later slices, and GitHub Actions remains deferred.

Everything below is the approved plan for later slices, not yet implemented.

Destructive automated tests (database writes, Storage cleanup, authenticated
end-to-end flows) must never target the normal development Supabase project.
A separate Supabase test project will be used — intended name
`pokeforce-companion-test` — so the database, Auth users, Storage objects,
and policies are all isolated by the project boundary. The Storage bucket
keeps the production name `game-images` inside the isolated project; the
project boundary is the isolation, and renaming would force a production
code change for no safety gain. The test project gets one manually created
test admin (a second non-admin user may be added later for authorization
tests), and no service-role key will be introduced there either.

Real test credentials and URLs belong only in `.env.test.local`, which is
already ignored by the existing `.env.*.local` rule and must stay ignored.
The committed `.env.test.example` contains variable names and placeholders
only. Future guarded commands will load `.env.test.local` explicitly, with
test values overriding any inherited development values; bare Prisma
commands will not be used for destructive test operations. Unit tests remain
service-free and never load the test environment.

A code-level safety guard will protect every destructive command: it
requires `SUPABASE_TEST_PROJECT_REF` to be set, verifies that both
`DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` belong to that test project,
and requires the test-only Auth values to be present. The guard fails —
with a readable message that prints no secrets — before any Prisma, Auth,
or Storage client is created. `NODE_ENV=test` alone is deliberately not
sufficient, because it proves nothing about which project would be written.

Database lifecycle: migrations are applied to the test project with
`prisma migrate deploy`; test data is cleaned in foreign-key-safe order
(RecipeIngredient, Recipe, Item, Profession, Category) and reseeded with
the existing deterministic seed. Tests use the stable seed slugs as
handles and never hard-code generated database IDs. Database-backed tests
run serially at first. The test project is disposable and may be reset at
any time without touching development.

Auth and Storage lifecycle: the test admin's credentials live only in
`.env.test.local`; Playwright will later save authenticated state under
`playwright/.auth/`, which is ignored along with Playwright's generated
output. Storage cleanup only ever operates inside the isolated test
project, and a failed run is recovered by the next guarded cleanup/prepare
run rather than by manual repair.

Reason:

One accidental destructive run against the development project would cost
real data and real Storage objects; project-level isolation plus an
explicit fail-closed guard makes that class of mistake structurally
impossible instead of merely unlikely. A separate hosted test project
reuses the exact dashboard skills already practiced in Milestones 3, 5,
and 6, which suits this beginner-led workflow better than new local
tooling. The guard extends the project's established fail-secure posture
(`requireAdminUser()` denying when unconfigured) to test infrastructure.

Alternatives considered:

- Running destructive tests against the development project with careful
  cleanup — rejected; cleanup bugs or interrupted runs would damage real
  data, and "careful" is not a boundary.
- Local Supabase via the CLI and Docker — rejected for now; heavier
  Windows setup and a second way of running Supabase to learn, with no
  safety advantage over a separate hosted project. May be revisited later.
- Renaming the test bucket (e.g. `game-images-test`) — rejected; the
  bucket name is a hard-coded production constant, and the project
  boundary already isolates Storage completely.
- Guarding on `NODE_ENV=test` — rejected; it does not prove the loaded
  configuration points at the test project.