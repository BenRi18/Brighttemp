import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/site-url";

/**
 * Keeps search engines on the public pages. Everything behind a sign-in is
 * off limits — not as a security measure (RLS does that) but so practice and
 * locum pages never surface in a search result.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/practice", "/locum", "/admin", "/onboarding", "/auth", "/api", "/dev", "/pending"],
    },
    sitemap: `${canonicalUrl()}/sitemap.xml`,
    host: canonicalUrl(),
  };
}
