import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The authentication proxy clones request bodies before Server Actions
    // receive them. Keep its buffer aligned with the action limit below or
    // a valid multi-asset publication would be truncated at Next's 10 MB
    // proxy default before application validation can run.
    proxyClientMaxBodySize: "24mb",
    serverActions: {
      // One appearance save may legitimately carry all five replacements
      // (three 5 MB wallpapers, a 5 MB logo, and a 1 MB favicon). The
      // action validates each role independently before publication.
      bodySizeLimit: "24mb",
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
