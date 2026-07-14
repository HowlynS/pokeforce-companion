import { describe, expect, it } from "vitest";
import { assertIsolatedTestEnvironment } from "@/lib/testing/test-environment";

// Clearly fake fixtures — never real refs, hosts, keys, or passwords.
const TEST_REF = "abcdefghijklmnopqrst";
const OTHER_REF = "zzzzyyyyxxxxwwwwvvvv";
const FAKE_DB_PASSWORD = "fake-db-password";
const FAKE_ANON_KEY = "fake-anon-key-value";
const FAKE_ADMIN_EMAIL = "test-admin@example.com";
const FAKE_ADMIN_PASSWORD = "fake-admin-password";

const POOLED_TEST_URL = `postgresql://postgres.${TEST_REF}:${FAKE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
const DIRECT_TEST_URL = `postgresql://postgres:${FAKE_DB_PASSWORD}@db.${TEST_REF}.supabase.co:5432/postgres`;

function validEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    SUPABASE_TEST_PROJECT_REF: TEST_REF,
    DATABASE_URL: POOLED_TEST_URL,
    NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: FAKE_ANON_KEY,
    ADMIN_EMAIL: FAKE_ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD: FAKE_ADMIN_PASSWORD,
    ...overrides,
  };
}

function messageFrom(env: Record<string, string | undefined>): string {
  try {
    assertIsolatedTestEnvironment(env);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected the guard to throw for this environment");
}

const REQUIRED_VARIABLES = [
  "SUPABASE_TEST_PROJECT_REF",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
];

describe("assertIsolatedTestEnvironment — valid configurations", () => {
  it("accepts a pooled Supabase connection string for the test project", () => {
    expect(() => assertIsolatedTestEnvironment(validEnv())).not.toThrow();
  });

  it("accepts a direct Supabase connection string for the test project", () => {
    expect(() =>
      assertIsolatedTestEnvironment(validEnv({ DATABASE_URL: DIRECT_TEST_URL }))
    ).not.toThrow();
  });

  it("accepts the postgres: protocol alias", () => {
    expect(() =>
      assertIsolatedTestEnvironment(
        validEnv({
          DATABASE_URL: POOLED_TEST_URL.replace("postgresql:", "postgres:"),
        })
      )
    ).not.toThrow();
  });
});

describe("assertIsolatedTestEnvironment — missing and blank values", () => {
  it.each(REQUIRED_VARIABLES)("throws when %s is missing", (name) => {
    const env = validEnv();
    delete env[name];

    expect(messageFrom(env)).toContain(`${name} is missing or blank`);
  });

  it.each(REQUIRED_VARIABLES)("throws when %s is whitespace only", (name) => {
    expect(messageFrom(validEnv({ [name]: "   " }))).toContain(
      `${name} is missing or blank`
    );
  });
});

describe("assertIsolatedTestEnvironment — project-ref validation", () => {
  it.each(["your-project-ref", "test-project-ref", "example", "placeholder"])(
    "rejects the placeholder ref %j",
    (ref) => {
      expect(messageFrom(validEnv({ SUPABASE_TEST_PROJECT_REF: ref }))).toContain(
        "Refusing to run"
      );
    }
  );

  it.each([
    ["uppercase characters", "ABCDEFGHIJKLMNOPQRST"],
    ["punctuation", "abcdefghijklmnop!rst"],
    ["an embedded space", "abcdefghij klmnopqrst"],
    ["a URL-shaped value", `https://${TEST_REF}.supabase.co`],
    ["a too-short value", "abc123"],
  ])("rejects a ref containing %s", (_label, ref) => {
    expect(
      messageFrom(validEnv({ SUPABASE_TEST_PROJECT_REF: ref }))
    ).toContain("does not look like a Supabase project reference");
  });
});

describe("assertIsolatedTestEnvironment — DATABASE_URL mismatch and spoofing", () => {
  it.each([
    [
      "a pooled URL for a different project",
      `postgresql://postgres.${OTHER_REF}:${FAKE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    ],
    [
      "a direct URL for a different project",
      `postgresql://postgres:${FAKE_DB_PASSWORD}@db.${OTHER_REF}.supabase.co:5432/postgres`,
    ],
    [
      "the test ref appearing only in the password",
      `postgresql://postgres.${OTHER_REF}:${TEST_REF}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    ],
    [
      "the test ref appearing only in a query parameter",
      `postgresql://postgres:${FAKE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?ref=${TEST_REF}`,
    ],
    [
      "the test ref appearing only in the database name",
      `postgresql://postgres:${FAKE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/${TEST_REF}`,
    ],
    [
      "a visually similar but non-exact ref",
      `postgresql://postgres.${TEST_REF}x:${FAKE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    ],
    [
      "a pooled-style username on a non-Supabase host",
      `postgresql://postgres.${TEST_REF}:${FAKE_DB_PASSWORD}@database.example.com:5432/postgres`,
    ],
    [
      "a direct-style host with a spoofed suffix",
      `postgresql://postgres:${FAKE_DB_PASSWORD}@db.${TEST_REF}.supabase.co.example.com:5432/postgres`,
    ],
  ])("rejects %s", (_label, url) => {
    expect(messageFrom(validEnv({ DATABASE_URL: url }))).toContain(
      "does not belong to the Supabase test project"
    );
  });

  it("rejects a non-PostgreSQL URL", () => {
    expect(
      messageFrom(
        validEnv({
          DATABASE_URL: `mysql://postgres.${TEST_REF}:${FAKE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:3306/postgres`,
        })
      )
    ).toContain("not a PostgreSQL connection string");
  });

  it("rejects a malformed URL", () => {
    expect(messageFrom(validEnv({ DATABASE_URL: "not a url" }))).toContain(
      "not a valid URL"
    );
  });
});

describe("assertIsolatedTestEnvironment — NEXT_PUBLIC_SUPABASE_URL mismatch and spoofing", () => {
  it.each([
    ["plain HTTP", `http://${TEST_REF}.supabase.co`],
    ["a different project's host", `https://${OTHER_REF}.supabase.co`],
    ["a suffix attack", `https://${TEST_REF}.supabase.co.example.com`],
    ["a prefix attack", `https://evil-${TEST_REF}.supabase.co`],
    ["embedded credentials", `https://user:pass@${TEST_REF}.supabase.co`],
    ["a non-root path", `https://${TEST_REF}.supabase.co/evil`],
    ["a query string", `https://${TEST_REF}.supabase.co/?redirect=evil`],
    ["a fragment", `https://${TEST_REF}.supabase.co/#evil`],
    ["an explicit port", `https://${TEST_REF}.supabase.co:8443`],
  ])("rejects %s", (_label, url) => {
    expect(
      messageFrom(validEnv({ NEXT_PUBLIC_SUPABASE_URL: url }))
    ).toContain("not exactly the HTTPS base URL");
  });

  it("rejects a malformed URL", () => {
    expect(
      messageFrom(validEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url" }))
    ).toContain("not a valid URL");
  });
});

describe("assertIsolatedTestEnvironment — remaining fields", () => {
  it.each(["not-an-email", "missing-domain@", "has spaces@example.com", "a@b"])(
    "rejects the malformed admin email %j",
    (email) => {
      expect(messageFrom(validEnv({ ADMIN_EMAIL: email }))).toContain(
        "does not look like an email address"
      );
    }
  );
});

describe("assertIsolatedTestEnvironment — error secrecy", () => {
  const failingEnvironments: [string, Record<string, string | undefined>][] = [
    [
      "a wrong-project database URL",
      validEnv({
        DATABASE_URL: `postgresql://postgres.${OTHER_REF}:${FAKE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
      }),
    ],
    [
      "a wrong-project Supabase URL",
      validEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER_REF}.supabase.co` }),
    ],
    ["a malformed admin email", validEnv({ ADMIN_EMAIL: "not-an-email" })],
  ];

  it.each(failingEnvironments)(
    "never echoes supplied values when failing on %s",
    (_label, env) => {
      const message = messageFrom(env);

      expect(message).not.toContain(FAKE_DB_PASSWORD);
      expect(message).not.toContain(FAKE_ANON_KEY);
      expect(message).not.toContain(FAKE_ADMIN_PASSWORD);
      expect(message).not.toContain(FAKE_ADMIN_EMAIL);
      expect(message).not.toContain("pooler.supabase.com");
      expect(message).not.toContain(OTHER_REF);
    }
  );

  it("always starts with the refusal prefix", () => {
    const message = messageFrom(validEnv({ TEST_ADMIN_PASSWORD: "" }));

    expect(
      message.startsWith(
        "Refusing to run against an unverified test environment."
      )
    ).toBe(true);
  });
});
