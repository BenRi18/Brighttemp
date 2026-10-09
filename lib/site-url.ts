/**
 * The one true public address of this site.
 *
 * Every email Supabase sends carries a link back here, so getting this wrong
 * is how people end up on a page that won't load. The old version fell back to
 * the request's Host header, which behind Hostinger's Node proxy is the
 * internal bind address — so confirmation links came out as
 * http://<ip>:<port>/auth/callback, which nothing outside the server can open.
 *
 * Order of trust:
 *   1. SITE_URL                      — read at runtime; set this one on the host
 *   2. NEXT_PUBLIC_SITE_URL          — baked in at build time (see below)
 *   3. x-forwarded-host              — what the proxy says the public name is
 *   4. host                          — last resort
 *
 * SITE_URL comes first for a reason. Next inlines every NEXT_PUBLIC_ variable
 * into the compiled output at BUILD time — the value is a string literal in the
 * bundle, not a lookup. So if the host builds the app before that variable is
 * set, changing it in the control panel afterwards does nothing at all, however
 * many times you restart. SITE_URL has no such prefix, so it is read fresh on
 * every request and a restart is enough.
 *
 * A candidate that is an IP address, localhost, or carries a port is rejected
 * in production: it would produce a link no one can open, and failing loudly
 * beats emailing a dead link.
 */
import { headers } from "next/headers";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"]);

/** Bare IPv4/IPv6, with or without a port. */
function isIpAddress(hostname: string) {
  const bare = hostname.replace(/^\[|\]$/g, "");
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || bare.includes(":");
}

function usableInProduction(hostHeader: string) {
  const hostname = hostHeader.split(":")[0].toLowerCase();
  if (!hostname) return false;
  if (LOCAL_HOSTNAMES.has(hostname)) return false;
  if (isIpAddress(hostname)) return false;
  // A public name has a dot in it. "brighttemp" on its own is an internal alias.
  return hostname.includes(".");
}

function normalise(url: string) {
  return url.trim().replace(/\/+$/, "");
}

/**
 * The configured address, ignored in production if it points somewhere nobody
 * can reach. A stale NEXT_PUBLIC_SITE_URL baked into an old build is the likely
 * culprit — it would otherwise quietly win and email everyone a localhost link.
 */
function configuredSiteUrl(): string | null {
  const raw = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return null;
  const value = normalise(raw);
  if (process.env.NODE_ENV !== "production") return value;
  try {
    if (!usableInProduction(new URL(value).host)) return null;
  } catch {
    return null; // not a URL at all
  }
  return value;
}

/**
 * Absolute origin for links sent out by email, e.g. https://brighttempbookinghub.co.uk.
 * Throws rather than returning something undeliverable.
 */
export async function siteUrl(): Promise<string> {
  const configured = configuredSiteUrl();
  if (configured) return configured;

  const h = await headers();
  // Always https in production. Next fills x-forwarded-proto in from the
  // connection it received, which behind a TLS-terminating proxy is the
  // plain-http hop between proxy and app — and a link emailed as http://
  // either warns the recipient or gets rewritten by their mail client.
  const proto =
    process.env.NODE_ENV === "production"
      ? "https"
      : (h.get("x-forwarded-proto")?.split(",")[0].trim() ?? "http");
  const candidates = [h.get("x-forwarded-host"), h.get("host")]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.split(",")[0].trim());

  if (process.env.NODE_ENV !== "production") {
    const [first] = candidates;
    return normalise(`${proto}://${first ?? "localhost:3000"}`);
  }

  const usable = candidates.find(usableInProduction);
  if (usable) return normalise(`${proto}://${usable}`);

  throw new Error(
    "SITE_URL is not set to a public address, and the request's host header is not one " +
      "either, so any link emailed from here would be unopenable. Set " +
      "SITE_URL to the live domain (https://brighttempbookinghub.co.uk) in the " +
      "hosting environment variables and restart the app.",
  );
}

/** The live domain, for anything built without a request to read — sitemap, robots, metadata. */
export const CANONICAL_URL = "https://brighttempbookinghub.co.uk";

/**
 * Site address outside a request. Uses the configured value when there is one,
 * so a staging deploy describes itself correctly, and otherwise the live
 * domain. Unlike siteUrl() this never throws — a sitemap is not worth failing
 * a build over.
 */
export function canonicalUrl() {
  return configuredSiteUrl() ?? CANONICAL_URL;
}

/**
 * Keeps a redirect on this site. Anything absolute, protocol-relative or
 * missing is replaced with the fallback, so a crafted `next` parameter can't
 * bounce someone off to another domain carrying their session.
 */
export function safeInternalPath(next: string | null | undefined, fallback = "/") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  // A trailing slash means a template interpolated an empty value, e.g.
  // next=/onboarding/ when user_type was missing from the metadata.
  if (next.length > 1 && next.split("?")[0].endsWith("/")) return fallback;
  return next;
}
