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
 *   1. NEXT_PUBLIC_SITE_URL          — set this on the host and nothing else matters
 *   2. x-forwarded-host              — what the proxy says the public name is
 *   3. host                          — last resort
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
 * Absolute origin for links sent out by email, e.g. https://brighttemp.co.uk.
 * Throws rather than returning something undeliverable.
 */
export async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return normalise(configured);

  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
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
    "NEXT_PUBLIC_SITE_URL is not set and the request's host header is not a public " +
      "address, so any link emailed from here would be unopenable. Set " +
      "NEXT_PUBLIC_SITE_URL to the live domain (for example https://brighttemp.co.uk) " +
      "in the hosting environment variables and restart the app.",
  );
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
