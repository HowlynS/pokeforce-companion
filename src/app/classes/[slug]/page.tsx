import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentImage } from "@/components/content/content-image";
import { RichTextContent } from "@/components/content/rich-text-content";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { VerificationCard } from "@/components/ui/verification-card";
import { prisma } from "@/lib/db";
import { getCurrentGameVersion } from "@/lib/game-versions";

export const dynamic = "force-dynamic";

type PlayerClassDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PlayerClassDetailPage({
  params,
}: PlayerClassDetailPageProps) {
  const { slug } = await params;
  const playerClass = await prisma.playerClass.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      descriptionRich: true,
      image: true,
      updatedAt: true,
      verifiedAt: true,
      verifiedGameVersion: { select: { name: true } },
    },
  });

  if (!playerClass) notFound();

  // The ONE canonical current build: the GameVersion row marked isCurrent.
  const currentGameVersion = await getCurrentGameVersion(prisma);


  return (
    <AppShell scenic="detail" wide>
      <article className="public-detail-page profession-detail-page class-detail-page">
        <Breadcrumb
          segments={[
            { name: "Home", href: "/" },
            { name: "Classes", href: "/classes" },
          ]}
          current={playerClass.name}
        />

        <div className="public-detail-layout class-detail-layout">
          <div className="public-detail-main">
        <section
          className="profession-detail-hero resource-atmosphere resource-atmosphere--class"
          aria-labelledby="player-class-title"
        >
          <div className="profession-detail-stage">
            <ContentImage
              imagePath={playerClass.image}
              alt={`Image of ${playerClass.name}`}
              size="hero"
            />
          </div>

          <div className="profession-detail-copy">
            <p className="profession-detail-eyebrow">Class</p>
            <h1 id="player-class-title" className="public-resource-title">
              {playerClass.name}
            </h1>
            <RichTextContent
              value={playerClass.descriptionRich}
              fallback={playerClass.description}
              className="profession-description rich-text-content"
            />
            <div className="profession-detail-chips" aria-label="Class facts">
              <Link href="/classes" className="profession-detail-chip">
                Resource:&nbsp;<strong>Class</strong>
              </Link>
            </div>
          </div>
        </section>
          </div>

          {/* The canonical information column. A Class carries no public
              metadata beyond its own identity -- no counts, no level, no
              relations -- so this column holds Verification alone rather
              than a Details panel padded out with invented fields. The
              PLACEMENT is what is shared; the content stays honest. */}
          <aside
            className="public-detail-sidebar class-detail-sidebar"
            aria-label="Class information"
          >
            <VerificationCard
              stamp={playerClass}
              currentGameVersionName={currentGameVersion?.name ?? null}
              updatedAt={playerClass.updatedAt}
            />
          </aside>
        </div>
      </article>
    </AppShell>
  );
}
