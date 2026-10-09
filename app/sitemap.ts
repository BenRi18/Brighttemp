import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/site-url";

/** The pages anyone can reach without signing in. */
const PUBLIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/faqs", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/register/practice", priority: 0.8, changeFrequency: "yearly" as const },
  { path: "/register/locum", priority: 0.8, changeFrequency: "yearly" as const },
  { path: "/login", priority: 0.4, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = canonicalUrl();
  const lastModified = new Date();
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
