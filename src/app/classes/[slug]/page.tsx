import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentImage } from "@/components/content/content-image";
import { RichTextContent } from "@/components/content/rich-text-content";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { formatPublicVerification } from "@/lib/public-verification";

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

  const verification = formatPublicVerification(playerClass);
  const updatedAt = formatDisplayDate(playerClass.updatedAt);

  return (
    <AppShell scenic="detail" wide>
      <article className="profession-detail-page class-detail-page">
        <Breadcrumb
          segments={[
            { name: "Home", href: "/" },
            { name: "Classes", href: "/classes" },
          ]}
          current={playerClass.name}
        />

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

        <section
          className="profession-verification"
          aria-labelledby="player-class-verification-title"
        >
          <div className="profession-verification-heading">
            <h2 id="player-class-verification-title">Verification</h2>
            <p className="item-verification-state">
              {verification ? "Verified" : "Unverified"}
            </p>
          </div>
          <div>
            <p className="item-verification-copy">
              {verification ??
                "This Class’s gameplay information has not been verified for a Game Version."}
            </p>
            {updatedAt ? (
              <p className="profession-updated">Updated {updatedAt}</p>
            ) : null}
          </div>
        </section>
      </article>
    </AppShell>
  );
}
