import { Prisma } from "@/generated/prisma/client";
import type { RichTextValue } from "@/lib/rich-text";

type RichDescriptionFields = {
  description: string | null;
  descriptionRich: RichTextValue | null;
};

type PrismaRichDescription<T extends RichDescriptionFields> = Omit<
  T,
  "descriptionRich"
> & {
  descriptionRich: Prisma.InputJsonValue | typeof Prisma.DbNull;
};

/**
 * Prisma distinguishes a database NULL from JSON `null`. Rich descriptions
 * intentionally use SQL NULL for an empty optional document, matching the
 * migration and the public hide-empty contract.
 */
export function toPrismaRichDescription<T extends RichDescriptionFields>(
  value: T
): PrismaRichDescription<T> {
  return {
    ...value,
    descriptionRich: value.descriptionRich
      ? (value.descriptionRich as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
  };
}
