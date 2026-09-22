import type { NextConfig } from "next";

const config: NextConfig = {
  // Compliance documents are served through signed URLs from a private
  // bucket, never as public assets.
  images: { remotePatterns: [] },
};

export default config;
