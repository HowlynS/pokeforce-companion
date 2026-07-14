// Shared classification of Prisma's known request errors, preserving the
// exact semantics of the previously action-local guards: the value must be a
// genuine Prisma.PrismaClientKnownRequestError instance AND carry the exact
// code. A structurally similar object forged with a matching `code` string
// is never accepted. Only the error class is imported from the generated
// client — no PrismaClient is instantiated and no database or environment
// access occurs.

import { Prisma } from "@/generated/prisma/client";

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";
const MISSING_RECORD_ERROR_CODE = "P2025";
const FOREIGN_KEY_ERROR_CODE = "P2003";

function isKnownRequestErrorWithCode(
  error: unknown,
  code: string
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

/** True for Prisma's unique-constraint violation (P2002). */
export function isUniqueConstraintError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return isKnownRequestErrorWithCode(error, UNIQUE_CONSTRAINT_ERROR_CODE);
}

/** True for Prisma's record-not-found failure (P2025). */
export function isMissingRecordError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return isKnownRequestErrorWithCode(error, MISSING_RECORD_ERROR_CODE);
}

/** True for Prisma's foreign-key constraint failure (P2003). */
export function isForeignKeyError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return isKnownRequestErrorWithCode(error, FOREIGN_KEY_ERROR_CODE);
}
