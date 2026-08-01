import {
  cleanupPublicDesignFixtures,
  readPublicDesignFixtureCounts,
  setupPublicDesignFixtures,
} from "../src/lib/public-design/fixture-database";
import {
  cleanupPublicDesignFixtureStorage,
  ensurePublicDesignFixtureStorage,
} from "../src/lib/public-design/fixture-storage";
import { getVerifiedTestPrisma } from "../src/lib/testing/integration-database";

async function main(): Promise<void> {
  const action = process.argv[2] ?? "setup";
  if (!["setup", "cleanup", "status"].includes(action)) {
    throw new Error("Usage: pnpm public:design:fixtures [setup|cleanup|status]");
  }

  const prisma = await getVerifiedTestPrisma();
  try {
    if (action === "setup") {
      await ensurePublicDesignFixtureStorage();
      try {
        await setupPublicDesignFixtures(prisma);
      } catch (error) {
        await cleanupPublicDesignFixtureStorage();
        throw error;
      }
      const counts = await readPublicDesignFixtureCounts(prisma);
      process.stdout.write(`Public design fixtures ready: ${JSON.stringify(counts)}\n`);
    } else if (action === "cleanup") {
      const removed = await cleanupPublicDesignFixtures(prisma);
      await cleanupPublicDesignFixtureStorage();
      process.stdout.write(`Public design fixture rows removed: ${removed}\n`);
    } else {
      const counts = await readPublicDesignFixtureCounts(prisma);
      process.stdout.write(`${JSON.stringify(counts)}\n`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Public design fixture command failed."}\n`
  );
  process.exitCode = 1;
});
