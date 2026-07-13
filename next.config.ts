import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Slightly above the 5 MB application-level image limit so a maximum-
      // size upload still fits once multipart/form-data overhead is added.
      bodySizeLimit: "6mb",
    },
  },
};

// The Supabase project URL is public configuration (it is already exposed to
// the browser as NEXT_PUBLIC_SUPABASE_URL); only its hostname is needed so
// next/image accepts the bucket's public objects. Guarded so a missing
// variable degrades to "no remote images allowed" instead of a build crash.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (supabaseUrl) {
  nextConfig.images = {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(supabaseUrl).hostname,
        pathname: "/storage/v1/object/public/game-images/**",
      },
    ],
  };
}

export default nextConfig;
