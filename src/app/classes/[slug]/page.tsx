import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentImage } from "@/components/content/content-image";
import { RichTextContent } from "@/components/content/rich-text-content";
import { AppShell } from "@/components/layout/app-shell";
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

  if (!playerClass) {
    notFound();
  }

  const verification = formatPublicVerification(playerClass);
  const updatedAt = formatDisplayDate(playerClass.updatedAt);

  return (
    <AppShell wide>
      <article className="item-detail-page profession-detail-page">
        <nav
          aria-label="Breadcrumb"
          className="public-breadcrumb item-breadcrumb"
        >
          <ol>
            <li>
              <Link href="/" className="breadcrumb-link">
                Home
              </Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <Link href="/classes" className="breadcrumb-link">
                Classes
              </Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{playerClass.name}</span>
            </li>
          </ol>
        </nav>

        <div className="profession-codex-frame profession-codex-frame--sparse">
          <section
            className="profession-discipline-hero"
            aria-labelledby="player-class-title"
          >
            <div className="profession-identity-stage">
              <ContentImage
                imagePath={playerClass.image}
                alt={`Image of ${playerClass.name}`}
                size="hero"
              />
            </div>

            <div className="profession-identity-copy">
              <p className="item-category-label">Class</p>
              <h1 id="player-class-title" className="public-resource-title">
                {playerClass.name}
              </h1>
              <RichTextContent
                value={playerClass.descriptionRich}
                fallback={playerClass.description}
                className="profession-description rich-text-content"
              />
              {updatedAt ? (
                <p className="profession-updated">Updated {updatedAt}</p>
              ) : null}
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
            <p className="item-verification-copy">
              {verification ??
                "This Class’s gameplay information has not been verified for a Game Version."}
            </p>
          </section>
        </div>
      </article>
    </AppShell>
  );
}
