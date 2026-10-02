import type { NextConfig } from "next";

const config: NextConfig = {
  // Compliance documents are served through signed URLs from a private
  // bucket, never as public assets.
  images: { remotePatterns: [] },

  experimental: {
    serverActions: {
      // Compliance uploads allow files up to 10MB (features/compliance/schema.ts).
      // Server Actions default to 1MB, which rejected them with
      // "Body exceeded 1 MB limit". The headroom covers the multipart encoding
      // and the other form fields.
      bodySizeLimit: "12mb",
    },
  },
};

export default config;
