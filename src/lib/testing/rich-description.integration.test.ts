import { afterAll, describe, expect, it } from "vitest";
import {
  plainTextToRichText,
  richTextToPlainText,
  type RichTextValue,
} from "@/lib/rich-text";
import { toPrismaRichDescription } from "@/lib/rich-text-prisma";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

const RUN = crypto.randomUUID();
const SLUG = `integration-rich-description-${RUN}`;

const createdDocument = plainTextToRichText("Created description.");
const editedDocument: RichTextValue = {
  version: 1,
  doc: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Edited section" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Formatted description.",
            marks: [{ type: "bold" }],
          },
        ],
      },
    ],
  },
};

function persistedDescription(value: RichTextValue | null) {
  return toPrismaRichDescription({
    description: richTextToPlainText(value),
    descriptionRich: value,
  });
}

describe("structured rich-description persistence (integration)", () => {
  afterAll(async () => {
    const prisma = await getVerifiedTestPrisma();
    await prisma.shop.deleteMany({ where: { slug: SLUG } });
    await prisma.item.deleteMany({ where: { slug: SLUG } });
    await prisma.category.deleteMany({ where: { slug: SLUG } });
    await prisma.profession.deleteMany({ where: { slug: SLUG } });
    await prisma.playerClass.deleteMany({ where: { slug: SLUG } });
    await prisma.currency.deleteMany({ where: { slug: SLUG } });
    await prisma.location.deleteMany({ where: { slug: SLUG } });
    await prisma.gameVersion.deleteMany({
      where: { name: `Rich description ${RUN}` },
    });
    await disconnectTestPrisma();
  });

  it("creates, edits, and reloads structured descriptions for all eight authored resources", async () => {
    const prisma = await getVerifiedTestPrisma();
    const createFields = persistedDescription(createdDocument);
    const editFields = persistedDescription(editedDocument);

    const gameVersion = await prisma.gameVersion.create({
      data: { name: `Rich description ${RUN}`, ...createFields },
    });
    const category = await prisma.category.create({
      data: { name: "Rich description category", slug: SLUG, ...createFields },
    });
    const item = await prisma.item.create({
      data: { name: "Rich description item", slug: SLUG, ...createFields },
    });
    const profession = await prisma.profession.create({
      data: {
        name: "Rich description profession",
        slug: SLUG,
        ...createFields,
      },
    });
    const playerClass = await prisma.playerClass.create({
      data: { name: "Rich description class", slug: SLUG, ...createFields },
    });
    const location = await prisma.location.create({
      data: {
        name: "Rich description location",
        slug: SLUG,
        type: "TOWN",
        ...createFields,
      },
    });
    const currency = await prisma.currency.create({
      data: { name: "Rich description currency", slug: SLUG, ...createFields },
    });
    const shop = await prisma.shop.create({
      data: {
        name: "Rich description shop",
        slug: SLUG,
        locationId: location.id,
        ...createFields,
      },
    });

    const reloaded = await Promise.all([
      prisma.gameVersion.update({
        where: { id: gameVersion.id },
        data: editFields,
      }),
      prisma.category.update({ where: { id: category.id }, data: editFields }),
      prisma.item.update({ where: { id: item.id }, data: editFields }),
      prisma.profession.update({
        where: { id: profession.id },
        data: editFields,
      }),
      prisma.playerClass.update({
        where: { id: playerClass.id },
        data: editFields,
      }),
      prisma.location.update({ where: { id: location.id }, data: editFields }),
      prisma.currency.update({ where: { id: currency.id }, data: editFields }),
      prisma.shop.update({ where: { id: shop.id }, data: editFields }),
    ]);

    for (const resource of reloaded) {
      expect(resource).toMatchObject({
        description: "Edited section\nFormatted description.",
        descriptionRich: editedDocument,
      });
    }
  });
});
