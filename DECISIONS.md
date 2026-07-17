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

---

### 2026-07-15 — Automated testing foundation complete; test execution cadence

Decision:

The Milestone 7 automated testing foundation planned in the 2026-07-14
entry is implemented and verified. The project now has: Vitest unit tests;
guarded Prisma database integration tests; Supabase Auth/Storage service
tests; Playwright (Chromium-only) public and authenticated E2E tests; the
isolated Supabase test project; the fail-closed `.env.test.local`
environment guard in front of every test client; deterministic
prefix-scoped cleanup with seeded-fixture preservation checks; and
authenticated admin coverage for Categories, Professions, Items, and
Recipes, including the full image workflow for Items, Professions, and
Recipes. Verified totals: 189 unit, 26 integration, 9 service, 70 E2E —
294 automated tests. The commands are `pnpm test:unit`,
`pnpm test:env:check`, `pnpm test:integration`, `pnpm test:service`, and
`pnpm test:e2e`. The foundation covers current behavior only; future
features must bring their own tests.

The established test execution cadence is:

- During implementation: run only the directly relevant targeted suite or
  spec; do not run the entire stack after every small edit.
- Before a checkpoint commit: the relevant suite; the environment guard
  where external test resources are involved; the regression suites
  appropriate to the change; `pnpm lint`; `pnpm build`; `git diff --check`.
- Before a milestone completion or major push: full unit, environment
  guard, integration, service, full E2E, lint, build, and the guard-first
  read-only preservation audit.
- A second full E2E run is required only for new cleanup-sensitive
  infrastructure, destructive test workflows, suspected flakiness, or
  major harness changes — not for routine feature edits.

Clarification recorded while testing the Recipe form: resulting quantity
and ingredient quantities must be finite positive integers; the browser
inputs use `min=1` and `step=1`; no upper bound currently exists. A value
such as `9999` is accepted but is not a maximum — any earlier impression
that quantities are capped at 9999 is inaccurate. This documents current
behavior only; no validation change was made.

Reason:

The cadence balances fast feedback during implementation against full
confidence at commit and push boundaries, and it matches how every
testing-foundation slice was actually verified. Recording the quantity
contract prevents a stale "maximum 9999" assumption from resurfacing in
future validation or search work.

Alternatives considered:

- Running the full stack after every edit — rejected; the full E2E suite
  takes minutes and would slow every small change without adding safety
  beyond the checkpoint runs.
- Requiring a double full E2E run at every checkpoint — rejected; the
  double run proved its value for cleanup-sensitive infrastructure and is
  kept for that class of change only.

---

### 2026-07-15 — Supabase Data API disabled; Prisma is the only game-data access layer

Decision:

The Supabase Data API (PostgREST REST endpoints and GraphQL) is disabled
on both the main project and the isolated test project. This is the
final, intentional architecture:

- Prisma is the exclusive game-data access layer, connecting over direct
  PostgreSQL — never through PostgREST.
- Supabase Auth remains enabled and used (login, session cookies, the
  admin check).
- Supabase Storage remains enabled and used (the `game-images` bucket).
- The `public` Prisma tables (Category, Item, Profession, Recipe,
  RecipeIngredient, `_prisma_migrations`) are no longer exposed through
  generated REST or GraphQL endpoints.
- No service-role key is used by the application or the tests.
- Public read access to the Storage bucket remains intentional; Storage
  writes and deletes remain protected by the authenticated-admin policies.

Background: the Security Advisor reported "RLS Disabled in Public" for all
six tables because they sat in the PostgREST-exposed `public` schema with
RLS off, meaning the public anon key could have read or written them
through the generated REST endpoints. A repository audit confirmed that no
application or test code uses `supabase.from(<table>)`, RPC, GraphQL, or
any `/rest/v1/` call — every Supabase client call is Auth or Storage, and
all game data flows through Prisma. After the Data API was disabled in
both dashboards, the Security Advisor was rerun and reports no security
errors, and the full verification stack (environment guard, 26
integration, 9 service, 70 E2E, lint, build, preservation audit) passed
unchanged.

Reason:

Disabling an API surface that nothing uses removes the exposure entirely
and permanently, with zero application impact — Prisma, Auth, Storage, and
public image serving are all separate services unaffected by the change.

Alternatives considered:

- Enabling RLS with policies on every table (keeping the Data API) —
  rejected; it would protect an API surface the application never uses and
  add permanent policy maintenance for no benefit.
- Leaving the warning unaddressed — rejected; the anon key ships to every
  browser by design, so the exposed tables were a real risk, not a
  theoretical one.

---

### 2026-07-16 — Milestone 8 is Gameplay Data Expansion (complete); implemented decisions

Decision:

The milestone-numbering conflict is resolved: **Gameplay Data Expansion is
Milestone 8 and is complete.** Deployment — previously listed in
MILESTONES.md as Milestone 8 — is renumbered to a later milestone; it is
not complete and has not started. Milestone 9 route-hub work remains
deferred; no Milestone 9 implementation has begun.

The decisions implemented during Milestone 8:

- **Rarity removed; Held item added.** `Item.rarity` was dropped (never
  part of the confirmed scope) and the exact `Held item` Yes/No field was
  added as a required boolean defaulting to No (migration
  `20260716074543_refine_item_gameplay_fields`).
- **Opt-in game-build verification.** Item, Location, and
  AcquisitionSource carry `verifiedAt` / `verifiedBuildId` metadata that is
  stamped only by the explicit "Mark gameplay data as verified for the
  current build." checkbox. The build id always comes from the server-only
  `CURRENT_GAME_BUILD_ID` environment variable (`src/lib/game-build.ts`,
  guarded by `server-only` and failing loudly when unset) — never from
  client input. Normal edits never touch these fields, and the public
  verification line renders only when both fields are populated.
- **Profession coverage and in-place rename.** The full deterministic set
  of ten professions is seeded, and "Blacksmithing" was renamed to
  "Smithing" in place by a data migration
  (`20260716152420_rename_blacksmithing_to_smithing`) — an `UPDATE`, not a
  delete-and-recreate, so the row id and every `Recipe.professionId`
  relation are preserved.
- **Location hierarchy and deletion behavior.** The Location model
  (migration `20260716160417_add_location_model`) has a typed hierarchy
  via a parent/child self-relation with `onDelete: Restrict`: the database
  itself refuses to delete a location that still has children, and the
  admin delete action's `_count` pre-check exists only to show a friendly
  message before that constraint would fire. Children are never silently
  detached.
- **AcquisitionSource model and referential actions.** The
  AcquisitionSource model (migration
  `20260716170040_add_acquisition_sources`, 16 acquisition types) is owned
  by its Item (`onDelete: Cascade` — a source is meaningless without its
  item, mirroring RecipeIngredient), while its optional Location and
  Profession references use `SET NULL` so the acquisition fact survives
  losing its location or profession. Quantity is deliberately a single
  free-text field — no drop rates or structured conditions.
- **Populated-only optional sections.** The public "How to obtain" section
  renders only when an item has at least one acquisition source. The
  Milestone 8 closing audit extended this to a general rule: public detail
  pages never render empty optional sections — for a record with zero
  related entries the entire section (heading and empty-state component
  alike) is omitted. This now covers How to obtain, Produced by, Used as
  an ingredient in, a category's Items, a profession's Recipes, a recipe's
  Ingredients, and a location's Sub-locations. Top-level collection pages
  (`/items`, `/recipes`, `/professions`, `/categories`) keep their useful
  empty states when the whole collection is empty.
- **Item/source route-ownership enforcement.** The nested admin source
  routes (`/admin/items/[slug]/sources/[sourceId]/…`) treat a source id
  that does not belong to the item named in the URL exactly like a missing
  record (404), in both pages and server actions — a valid id from a
  different item's URL is never honored.

Reason:

Recording the resolved numbering prevents the stale "Milestone 8 -
Deployment" label from causing deployment work to be marked complete or
started by mistake. The individual decisions follow the project's
established postures: schema referential actions chosen by whether the
child is an owned detail row (cascade) or an independent resource
(restrict / set null); server-trusted values over client input for
anything that stamps or targets a mutation; and omission over placeholder
noise in public presentation.

Alternatives considered:

- Treating Deployment as still being Milestone 8 and renaming the gameplay
  work to 8.5 or 7.5 — rejected; the milestone conversation ran Gameplay
  Data Expansion as Milestone 8, and two things sharing one number is the
  exact confusion this entry resolves.
- Rendering empty optional sections with their empty states (the previous
  behavior) — rejected by the confirmed rule; on a record detail page an
  empty optional section is noise, unlike a collection page where the
  empty state explains a genuinely empty collection.
---

### 2026-07-17 — Milestone 9 Slice 9A: relational Game Version verification (implemented decisions)

Decision:

Milestone 9 is Admin Workspace & Game Version Management; Slice 9A (Game
Version foundation) is implemented. Route-hub work — previously listed as
Milestone 9 — remains deferred and unstarted; Slices 9B–9E (including the
shared admin workspace redesign) have not started.

Terminology: the contributor-facing term is "Game Version" everywhere.
"Build" never appears in the UI; the word survives only in historical
decision entries and migration names.

The GameVersion model: cuid id, unique display name (database unique
constraint plus the shared trimmed, case-insensitive duplicate rule),
optional release date (stored at UTC midnight so the value never shifts
with the server timezone), isCurrent flag, timestamps. At most one version
is current: every path that sets isCurrent runs through
setCurrentGameVersion() in src/lib/game-versions.ts, whose transaction
unsets the previous current row in the same commit. The very first version
ever created becomes current automatically (an empty table has nothing to
choose between); later versions never bootstrap themselves — with history
present, promotion is the admin's explicit call.

Gameplay verification is relational. Item, Location, and AcquisitionSource
migrated from the string verifiedBuildId to verifiedGameVersionId
(references GameVersion, ON DELETE RESTRICT); Recipe and Profession gained
verifiedAt/verifiedGameVersionId for the first time. Category deliberately
remains non-verifiable. RESTRICT means the database itself refuses to
delete a Game Version while any verification stamp references it — the
admin action's friendly count pre-check exists only to explain the refusal
before the constraint would fire. Historical versions therefore remain
available for as long as anything references them.

Migration handling (20260717011230_add_game_version_relational_verification):
written by hand because the auto-generated diff would have dropped
verifiedBuildId while it still held data. Order: create GameVersion; add
the new nullable columns beside the legacy ones; create one GameVersion
row per distinct legacy build string (name = the exact string, isCurrent
false); link every stamped row by name; a DO-block VERIFY aborts the whole
transactional migration if any stamped row failed to link; only then drop
the legacy columns; finally add indexes and the RESTRICT foreign keys.
Every verifiedAt value is untouched. Applied state: the development
database's one verified row (Item "charcoal", stamped 2026-07-16 for
"dev-build-1") now references a GameVersion named "dev-build-1"; the test
database had no verified rows, so its migration created no versions. No
migrated version is marked current — after deploying this migration an
admin must visit the settings screen and either promote "dev-build-1" or
create and promote a real version; until then, marking data as verified
fails with a clear message (the same fail-loud posture the missing
CURRENT_GAME_BUILD_ID had).

CURRENT_GAME_BUILD_ID is retired. The database row marked isCurrent is the
only source of truth for the current version. src/lib/game-build.ts and
its unit tests were deleted after every usage was migrated; the env
examples now document the retirement. Leftover values in local .env files
are harmless — nothing reads them.

Admin-only visibility. Game Versions are a secondary settings destination:
/admin/settings/game-versions (list, create with optional release date,
edit, mark current, delete with blocked-deletion feedback), reached from a
restrained Settings section at the bottom of the admin dashboard — never
primary navigation. The public verification line that item and location
detail pages used to render was removed; verification status now appears
only inside the admin edit forms (next to the opt-in checkbox). Public
pages never render Game Version or verification information.

Test infrastructure. Migrations reach the isolated test project only
through the new guarded launcher (pnpm test:db:migrate →
scripts/migrate-test-database.ts, same fail-closed guard-first pattern as
the E2E web server). The isolated test database carries one documented
test-only placeholder version, "test-gv-current", which the E2E auth setup
(re)creates and makes the ONLY current version before every browser run —
it replaces the deterministic CURRENT_GAME_BUILD_ID=test-build-001 the
tests previously read from .env.test.local. Integration suites create
versions under the test-gv- name prefix (GameVersion has no slug, so
name-prefix cleanup stands in for slug-prefix cleanup) and may sweep the
fixture too — the next E2E run recreates it. Browser tests for the
settings screen use the test-e2e-gv- name prefix and restore the fixture
as current after switching.

Reason:

A relational reference keeps verification stamps meaningful across
renames, makes "which version is current" a single administered fact
instead of a per-environment variable, lets the database enforce that
history cannot be deleted out from under a stamp, and gives Recipes and
Professions the same verification workflow the other gameplay models
already had. Migrating the legacy strings into named rows (rather than
discarding or reinterpreting them) preserves the historical meaning of
every existing stamp verbatim.

Alternatives considered:

- Keeping CURRENT_GAME_BUILD_ID as a fallback when no version is current —
  rejected; two sources of truth that can disagree, and the fail-loud
  "no current version" message is clearer than silently stamping from an
  environment variable.
- A partial unique index on isCurrent for database-level single-current
  enforcement — rejected for now; Prisma cannot express partial indexes in
  the schema, so a hand-added index would surface as drift and a future
  `migrate dev` could silently generate its DROP. The service transaction
  plus integration tests carry the invariant; revisit if Prisma gains
  support.
- Marking the migrated "dev-build-1" version current automatically —
  rejected; a migration should not silently decide what "current" means.
  The admin promotes a version explicitly through the new settings screen.
- Auto-promoting a new version whenever no current version exists (not
  just on the very first ever) — rejected; in the post-migration state
  (history present, nothing current) silent promotion would decide the
  current version as a side effect of creation.
- Putting Game Versions in the primary admin navigation — rejected by the
  milestone brief; it is settings, not day-to-day content management.

---

### 2026-07-17 — Slice 9A correction: selected-version verification, locked current-flag writes, isolated test fixtures

Decision:

Three corrections to the Slice 9A implementation recorded in the previous
entry, made during review before any commit. Where this entry and the
previous 2026-07-17 entry disagree, this entry is authoritative.

Selected-version verification. The milestone requires verifying a record
against a selected Game Version, including a historical one, so
resolveVerificationStamp (src/lib/game-versions.ts) no longer always
stamps the current version. A form may submit a `verifiedGameVersionId`;
the server validates that the id resolves to a real GameVersion row, and
any existing version — current or historical — is a valid selection. A
nonexistent or tampered id fails the whole submission with
`invalid_game_version`; it is never silently replaced with another
version. When the field is absent or blank, the stamp falls back to the
single row marked current — the exact behavior the existing admin forms
(which predate version selection and submit no picker value) have always
had — and fails clearly with `no_current_version` when nothing is
current. This fallback is a documented temporary compatibility measure:
the record-level Game Version picker UI is deferred to the admin
workspace slice, and until it exists "no selection" safely means "the
current version". The stamped `verifiedAt` always comes from the server
clock in both paths, and an unchecked verification checkbox still leaves
existing verification metadata untouched.

Locked current-flag writes. Under READ COMMITTED, two overlapping
mark-current transactions could each miss the other's uncommitted current
row and both commit as current. Both writers of the isCurrent flag
(createGameVersion's first-version bootstrap and setCurrentGameVersion)
now take the same transaction-scoped PostgreSQL advisory lock
(pg_advisory_xact_lock) before reading, so overlapping calls serialize
and the loser's demote step always sees the winner's committed row. The
single-current invariant therefore remains application-enforced — not
schema-enforced — because Prisma cannot express the partial unique index
that would otherwise carry it (unchanged from the previous entry); the
lock plus a dedicated overlapping-calls integration test carry it
instead.

Isolated test fixtures. The integration suites' Game Version name prefix
narrowed from test-gv- to test-gv-int-, so integration cleanup can no
longer delete the persistent browser fixture "test-gv-current" (which
E2E runs create, mark current, and deliberately never delete). Every
integration test that needs a controlled current-version state now
arranges it itself and restores the previously current version in its own
finally block — no test depends on execution order, on another test
having demoted the fixture, or (except the explicitly skipping bootstrap
test) on an empty GameVersion table.

Reason:

The always-current stamping contradicted the milestone's historical-
verification requirement; the unlocked transactions left a real
concurrency hole in the invariant the whole feature rests on; and the
original tests passed only through inter-test ordering side effects,
which would have made future failures misleading.

Alternatives considered:

- Rejecting submissions with no selected version once a picker exists
  everywhere — deferred; until the workspace slice adds the picker, the
  compatibility fallback keeps the existing forms working unchanged, and
  it can outlive them harmlessly.
- SERIALIZABLE isolation instead of an advisory lock — rejected; it
  surfaces as retryable serialization failures that every caller would
  need to handle, while a single transaction-scoped advisory lock is
  invisible to callers and scoped to exactly this one flag.
- Having the integration suite delete and recreate the browser fixture —
  rejected; tests should never own another suite's fixture, and
  temporary demote-plus-restore keeps every side effect inside the test
  that caused it.

---

### 2026-07-17 — Slice 9A clarification: compatibility Game Version picker supersedes the deferral

Decision:

The earlier same-day correction entry deferred the record-level Game
Version picker UI to the admin workspace slice. That deferral was
superseded during Slice 9A completion: without any picker, an
administrator could not actually use the historical-version verification
the milestone requires, so a minimal compatibility picker (the shared
GameVersionVerificationControls component) was added to the existing
Item, Location, Acquisition Source, Recipe, and Profession create/edit
forms. It slots into the existing form layouts and is deliberately NOT
the Slice 9B workspace redesign, which remains unstarted. The
server-validated selection, the blank-selection fallback to the current
version, and the advisory-lock single-current architecture are all
unchanged — the picker only proposes an id the server was already
prepared to validate.

Reason:

Historical-version verification had a tested server path but no way for
an administrator to reach it; a restrained picker inside the existing
forms closes that gap without starting the workspace redesign.

---

### 2026-07-17 — Slice 9B.1: shared admin shell architecture

Decision:

Every authenticated admin route now renders inside one shared,
desktop-first admin shell, applied exactly once by the /admin layout
after its unchanged requireAdminUser() gate. Three components carry the
architecture:

- AdminShell (src/components/admin/admin-shell.tsx): a persistent left
  sidebar (brand lockup linking to the public site, plus the primary
  navigation) beside a scrolling content area. Rendered at layout level,
  so it stays stable while navigating between admin sections; admin pages
  no longer wrap themselves in the public AppShell (which remains the
  public/login shell).
- AdminNav (src/components/admin/admin-nav.tsx) over the pure module
  src/lib/admin/admin-nav.ts: exactly six primary destinations —
  Dashboard, Items, Recipes, Professions, Categories, Locations. The
  active rule is pure and unit-tested: Dashboard on exactly /admin, each
  resource on its list route and every child route (path-segment
  boundary match), nothing on the secondary settings routes.
  aria-current="page" is simultaneously the accessible marker and the
  CSS styling hook, so the visual and accessible states cannot drift.
- AdminWorkspace (src/components/admin/admin-workspace.tsx): the
  structural composition later resource workspaces build on — a header
  region plus optional record-list column, primary region, and optional
  contextual aside. Slots only in this slice; absent slots render no
  reserved space. The dashboard is the reference composition; the five
  resource editors are deliberately unconverted.

Deliberately excluded from primary navigation: Game Versions (still the
dashboard's secondary settings link), Acquisition Sources (contextual
under their owning item — their routes light up Items), and any
users/roles/audit/route-hub destinations. No collapsed-sidebar mode. The
shell's styles live in globals.css using the existing token variables;
the content column uses min-width: 0 so wide tables keep scrolling in
their own wrappers at narrower desktop widths, and dedicated mobile
design stays out of scope.

Reason:

Later Slice 9B work converts each resource to a workspace; putting the
frame, navigation, and slot structure in one place first means those
conversions compose existing pieces instead of five pages each inventing
their own shell. Layout-level placement gives the persistence the
milestone asks for and keeps authorization exactly where it was.

Alternatives considered:

- Keeping per-page AppShell wrappers and adding a sidebar inside each
  page — rejected; the sidebar would remount per page and every future
  workspace would re-assemble its own frame.
- A configurable generic layout framework — rejected; exactly one header
  and three body slots is all the approved design needs.
- Adding a Settings entry to the sidebar — rejected; the brief keeps
  Game Versions reachable only through the existing secondary path.

---

### 2026-07-17 — Slice 9B.2: shared admin editor primitives

Decision:

The upcoming resource workspaces compose seven resource-agnostic
presentational components (src/components/admin/) instead of each
resource building its own editor chrome: EditorHeader, EditorTabs,
ContextPanel, ImagePanel, VerificationPanel, TimestampsPanel, and the
sticky EditorActions. Three decisions worth recording:

- Behavior stays where it already lives. ImagePanel is a structural
  wrapper around the EXISTING image controls (upload, replacement,
  removal, validation, storage, and cleanup are untouched — the panel
  only frames them and gives every upload surface a pointer cursor).
  VerificationPanel composes the existing
  GameVersionVerificationControls rather than duplicating any stamping
  rule; its unverified/current/outdated badge comes from the pure
  classification in src/lib/admin/verification-status.ts (a record
  verified against any non-current version — including when nothing is
  current — is "outdated"). EditorActions keeps plain HTML form
  submission and links Delete to the existing confirmation route; no
  client-side mutation architecture. EditorTabs are plain links with a
  caller-supplied active flag, so route tabs and query-state tabs both
  work without the component imposing a state architecture, and
  aria-current="page" is simultaneously the accessible marker and the
  styling hook (the same rule the admin sidebar uses).
- One deliberate admin accent token pair. The approved dark admin
  mockup uses purple for editor chrome, so --color-admin-accent /
  --color-admin-accent-soft (mirrored as designTokens.colors.adminAccent
  / adminAccentSoft) exist for selected tabs and editor highlights —
  editor chrome only, never the public design system, and no other
  one-off colors. --color-warning was also added to globals.css to keep
  it in sync with the existing designTokens.colors.warning.
- Component tests without a DOM library. .test.tsx files render the
  presentational components to static HTML with react-dom/server and
  assert on the markup (optional regions absent — not empty — when
  props are omitted; exactly one aria-current; composition of the real
  verification controls). This keeps the 2026-07-14 "no DOM library"
  testing decision intact; the unit Vitest config now also collects
  src/**/*.test.tsx.

No resource page adopts the primitives in this slice — Items becomes
the first reference workspace in a later slice. Loading/empty/error
presentation deliberately reuses the existing EmptyState component and
banner classes.

Reason:

The resource conversions ahead touch five editors; if the chrome is not
shared first, each conversion invents its own header/tabs/panels and
the workspaces drift apart. Wrapping instead of rewriting keeps every
hard-won behavior (storage cleanup ordering, verification trust model,
deletion confirmation flow) exactly where its tests already pin it.

Alternatives considered:

- A schema-driven generic form engine — rejected; five concrete
  editors do not justify one, and the brief forbids it.
- Adding a DOM testing library for component tests — rejected;
  static-markup assertions cover presentational components fully, and
  browser behavior stays with Playwright.
- Reusing the public yellow accent for editor chrome — rejected; the
  approved mockup separates admin editor identity, and one deliberate
  token pair is cheap while scattered hex values are not.

---

### 2026-07-17 — Slice 9B.3: record-list search is URL-driven and caller-owned

Decision:

The shared record-list column (RecordList + RecordListPagination,
src/components/admin/) renders search, rows, selection, and pagination
but owns NO data behavior: the caller runs the database query, applies
the filter, formats the count, and constructs every href — row links
(including nested editor routes), the create action, the clear target,
and pagination links carrying the active search parameters forward. The
component never builds a route and never fetches.

Search follows the public /search pattern: a plain GET form submitting a
URL parameter, server-rendered results, keyboard submission for free,
and no request per keystroke (live querying exists only in the
name-availability fields, which are a different concern). The Clear
link renders only while a query is applied. The selected record uses
aria-current="page" as both the accessible marker and the purple styling
hook — the third consumer of the convention after the sidebar and the
editor tabs. Pagination is deliberately minimal: previous/next links or
aria-disabled markers (never fake clickable links), with cursoring,
page-size controls, and total-page arithmetic left to whichever caller
ever needs them.

Reason:

Five resource workspaces will feed this column; if it owned querying it
would grow a generic data-fetching layer the brief forbids, and every
resource's route shapes differ (items nest sources; settings pages use
ids). URL-driven search keeps quick switching bookmarkable, shareable,
and testable server-side — consistent with how the whole application
already works without client JavaScript.

Alternatives considered:

- Live filtering on keystroke — rejected; no such pattern exists for
  lists here, it would need client state and debouncing, and the GET
  form matches the application's no-JS-required posture.
- The component accepting a Prisma delegate or query callback —
  rejected; that is the generic data-fetching framework the brief
  excludes, and it would couple a presentational component to the
  database client.

---

### 2026-07-17 — Slice 9B.4: Item workspace routes and slug-based identifiers

Decision:

Items adopted the shared workspace as the first production reference.
Two route decisions worth recording:

- The dedicated creation route is /admin/items/new, and the create
  action's ERROR redirects follow the form there while SUCCESS still
  returns to the list — an admin who fails validation stays on the form
  with the message; an admin who succeeds lands on the refreshed list.
  The static "new" segment cannot collide with an item, because no page
  exists at /admin/items/[slug] itself — records are reached only at
  /admin/items/[slug]/edit and deeper.
- The Item URL identifier REMAINS the slug, even though workspace-style
  editors often use database ids. Slugs are already the record
  identifier everywhere (public detail pages, the nested acquisition-
  sources routes, route-ownership checks, every existing test), and the
  server actions locate records by stable cuid ids from hidden form
  fields — never by the URL — so slugs in URLs cost nothing in
  correctness while keeping one identifier scheme across the site.

The active search query travels only through LINKS (?q= on record rows,
the create link, back/cancel links), never through action redirects:
after a save or delete the admin returns to the unfiltered list.
Threading q through every server action's redirects would touch all
three mutations for a convenience the workspace does not need yet.
Pagination is deferred: with sixteen seeded items plus test records, a
page parameter would be speculative; the shared RecordListPagination
primitive already exists for the moment a real need arrives.

Reason:

The smallest conversion that makes quick switching real: one thin
Item-specific wrapper over the shared pieces, the existing forms moved —
not modified — and every CRUD, image, verification, and deletion
protection left exactly where its tests pin it.

Alternatives considered:

- Switching edit/delete URLs to database ids — rejected; it would split
  the identifier scheme mid-resource (sources stay slug-nested), break
  public/admin consistency, and buy nothing the hidden-id form fields
  do not already provide.
- Keeping the create form embedded on the landing page alongside the
  record list — rejected; the milestone's workspace direction needs the
  landing to be a list-plus-editor surface, and a dedicated creation
  page gives validation errors a stable home.
