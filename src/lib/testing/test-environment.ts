// Fail-closed guard for the isolated Supabase TEST environment. Future
// destructive commands (database prepare/seed/clean, integration tests,
// authenticated E2E) must pass this check BEFORE any Prisma, Auth, or
// Storage client is created, so a misconfigured environment can never touch
// the normal development project. Pure and service-free: it only inspects
// the provided values and never reads process.env itself, performs I/O, or
// prints secrets.

const REFUSAL_PREFIX = "Refusing to run against an unverified test environment.";

const SETUP_HINT =
  "Copy .env.test.example to .env.test.local and fill in the isolated Supabase test project's values.";

// Supabase project refs are short lowercase alphanumeric identifiers.
const PROJECT_REF_PATTERN = /^[a-z0-9]{15,40}$/;

// Obvious template values that must never be accepted as a real ref.
const PLACEHOLDER_REFS = new Set([
  "your-project-ref",
  "test-project-ref",
  "example",
  "placeholder",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUIRED_VARIABLES = [
  "SUPABASE_TEST_PROJECT_REF",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
] as const;

// Error messages name the failing variable and category but never echo the
// supplied value — URLs, keys, emails, and passwords stay out of output.
function refuse(problem: string): never {
  throw new Error(`${REFUSAL_PREFIX} ${problem} ${SETUP_HINT}`);
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function assertIsolatedTestEnvironment(
  env: Readonly<Record<string, string | undefined>>
): void {
  for (const name of REQUIRED_VARIABLES) {
    const value = env[name];

    if (typeof value !== "string" || value.trim() === "") {
      refuse(`${name} is missing or blank.`);
    }
  }

  const projectRef = (env.SUPABASE_TEST_PROJECT_REF as string).trim();

  if (PLACEHOLDER_REFS.has(projectRef)) {
    refuse(
      "SUPABASE_TEST_PROJECT_REF is still a placeholder, not a real test project reference."
    );
  }

  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    refuse(
      "SUPABASE_TEST_PROJECT_REF does not look like a Supabase project reference (lowercase letters and digits only)."
    );
  }

  const databaseUrl = parseUrl((env.DATABASE_URL as string).trim());

  if (!databaseUrl) {
    refuse("DATABASE_URL is not a valid URL.");
  }

  if (
    databaseUrl.protocol !== "postgresql:" &&
    databaseUrl.protocol !== "postgres:"
  ) {
    refuse("DATABASE_URL is not a PostgreSQL connection string.");
  }

  // Supabase represents the project ref in exactly two places, depending on
  // the connection form:
  //   pooled:  postgresql://postgres.<ref>:...@...pooler.supabase.com/...
  //   direct:  postgresql://postgres:...@db.<ref>.supabase.co/...
  // Only those exact placements count — a ref hidden in the password, query
  // string, or database name must not qualify.
  const isPooledTestUrl =
    databaseUrl.username === `postgres.${projectRef}` &&
    databaseUrl.hostname.endsWith(".pooler.supabase.com");
  const isDirectTestUrl =
    databaseUrl.hostname === `db.${projectRef}.supabase.co`;

  if (!isPooledTestUrl && !isDirectTestUrl) {
    refuse(
      "DATABASE_URL does not belong to the Supabase test project named in SUPABASE_TEST_PROJECT_REF."
    );
  }

  const supabaseUrl = parseUrl((env.NEXT_PUBLIC_SUPABASE_URL as string).trim());

  if (!supabaseUrl) {
    refuse("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }

  const isExactTestProjectUrl =
    supabaseUrl.protocol === "https:" &&
    supabaseUrl.hostname === `${projectRef}.supabase.co` &&
    supabaseUrl.port === "" &&
    supabaseUrl.username === "" &&
    supabaseUrl.password === "" &&
    (supabaseUrl.pathname === "/" || supabaseUrl.pathname === "") &&
    supabaseUrl.search === "" &&
    supabaseUrl.hash === "";

  if (!isExactTestProjectUrl) {
    refuse(
      "NEXT_PUBLIC_SUPABASE_URL is not exactly the HTTPS base URL of the Supabase test project named in SUPABASE_TEST_PROJECT_REF."
    );
  }

  if (!EMAIL_PATTERN.test((env.ADMIN_EMAIL as string).trim())) {
    refuse("ADMIN_EMAIL does not look like an email address.");
  }

  // NEXT_PUBLIC_SUPABASE_ANON_KEY and TEST_ADMIN_PASSWORD only need to be
  // present and non-blank, which the loop above already enforced.
}
