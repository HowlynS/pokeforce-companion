import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  isForeignKeyError,
  isMissingRecordError,
  isUniqueConstraintError,
} from "@/lib/prisma-errors";

// A genuine Prisma known request error, built with the real error class the
// guards check against. No PrismaClient is created and nothing connects to
// a database.
function knownRequestError(
  code: string
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("database failure", {
    code,
    clientVersion: "test",
  });
}

// Values that merely LOOK like a Prisma error because they carry a matching
// code string. The guards must reject every one of these — the runtime class
// is required, not just the code.
function forgedLookalikes(code: string): [string, unknown][] {
  const errorWithCode = new Error("forged") as Error & { code: string };
  errorWithCode.code = code;

  class ForgedDatabaseError extends Error {
    code = code;
  }

  return [
    ["a plain object carrying the code", { code }],
    ["an ordinary Error with an assigned code", errorWithCode],
    ["a custom Error subclass carrying the code", new ForgedDatabaseError()],
    [
      "an object inheriting the code from its prototype",
      Object.create({ code }),
    ],
  ];
}

// Values no guard may ever classify as a Prisma error.
const malformedValues: [string, unknown][] = [
  ["null", null],
  ["undefined", undefined],
  ["a bare code string", "P2002"],
  ["a number", 2002],
  ["an ordinary Error without a code", new Error("plain failure")],
  ["an object with no code property", {}],
  ["an object with a non-string code", { code: 2002 }],
];

describe("isUniqueConstraintError", () => {
  it("recognizes a genuine Prisma error with code P2002", () => {
    expect(isUniqueConstraintError(knownRequestError("P2002"))).toBe(true);
  });

  it("rejects a genuine Prisma error with code P2025", () => {
    expect(isUniqueConstraintError(knownRequestError("P2025"))).toBe(false);
  });

  it("rejects a genuine Prisma error with code P2003", () => {
    expect(isUniqueConstraintError(knownRequestError("P2003"))).toBe(false);
  });

  it.each(forgedLookalikes("P2002"))(
    "rejects %s even though it carries P2002",
    (_label, value) => {
      expect(isUniqueConstraintError(value)).toBe(false);
    }
  );

  it.each(malformedValues)("rejects %s", (_label, value) => {
    expect(isUniqueConstraintError(value)).toBe(false);
  });
});

describe("isMissingRecordError", () => {
  it("recognizes a genuine Prisma error with code P2025", () => {
    expect(isMissingRecordError(knownRequestError("P2025"))).toBe(true);
  });

  it("rejects a genuine Prisma error with code P2002", () => {
    expect(isMissingRecordError(knownRequestError("P2002"))).toBe(false);
  });

  it("rejects a genuine Prisma error with code P2003", () => {
    expect(isMissingRecordError(knownRequestError("P2003"))).toBe(false);
  });

  it.each(forgedLookalikes("P2025"))(
    "rejects %s even though it carries P2025",
    (_label, value) => {
      expect(isMissingRecordError(value)).toBe(false);
    }
  );

  it.each(malformedValues)("rejects %s", (_label, value) => {
    expect(isMissingRecordError(value)).toBe(false);
  });
});

describe("isForeignKeyError", () => {
  it("recognizes a genuine Prisma error with code P2003", () => {
    expect(isForeignKeyError(knownRequestError("P2003"))).toBe(true);
  });

  it("rejects a genuine Prisma error with code P2002", () => {
    expect(isForeignKeyError(knownRequestError("P2002"))).toBe(false);
  });

  it("rejects a genuine Prisma error with code P2025", () => {
    expect(isForeignKeyError(knownRequestError("P2025"))).toBe(false);
  });

  it.each(forgedLookalikes("P2003"))(
    "rejects %s even though it carries P2003",
    (_label, value) => {
      expect(isForeignKeyError(value)).toBe(false);
    }
  );

  it.each(malformedValues)("rejects %s", (_label, value) => {
    expect(isForeignKeyError(value)).toBe(false);
  });
});

describe("unrecognized genuine Prisma codes", () => {
  it("a genuine Prisma error with another code is rejected by all three guards", () => {
    const otherError = knownRequestError("P2000");

    expect(isUniqueConstraintError(otherError)).toBe(false);
    expect(isMissingRecordError(otherError)).toBe(false);
    expect(isForeignKeyError(otherError)).toBe(false);
  });
});

describe("cross-guard exclusivity", () => {
  const guardsByCode = [
    ["P2002", isUniqueConstraintError],
    ["P2025", isMissingRecordError],
    ["P2003", isForeignKeyError],
  ] as const;

  it.each(guardsByCode)(
    "only the intended guard recognizes a genuine %s error",
    (code, intendedGuard) => {
      const error = knownRequestError(code);

      for (const [, guard] of guardsByCode) {
        expect(guard(error)).toBe(guard === intendedGuard);
      }
    }
  );
});
