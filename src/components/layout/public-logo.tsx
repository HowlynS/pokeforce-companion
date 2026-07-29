"use client";

import { useState } from "react";
import {
  DEFAULT_HEADER_LOGO_HEIGHT,
  DEFAULT_HEADER_LOGO_URL,
  DEFAULT_HEADER_LOGO_WIDTH,
} from "@/lib/appearance/defaults";

type PublicLogoProps = {
  height: number;
  src: string;
  width: number;
};

export function PublicLogo({ height, src, width }: PublicLogoProps) {
  const [asset, setAsset] = useState({ height, src, width });

  return (
    // A plain image supports cache-busted Supabase URLs. If a managed object is
    // later unavailable, the committed mark and its proportions take over.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.src}
      alt="Merchants Codex"
      width={asset.width}
      height={asset.height}
      className="public-site-logo"
      onError={() => {
        if (asset.src !== DEFAULT_HEADER_LOGO_URL) {
          setAsset({
            src: DEFAULT_HEADER_LOGO_URL,
            width: DEFAULT_HEADER_LOGO_WIDTH,
            height: DEFAULT_HEADER_LOGO_HEIGHT,
          });
        }
      }}
    />
  );
}
