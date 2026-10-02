import Link from "next/link";
import { BRAND } from "@/lib/brand";

/** The logo lockup: agency name in full, platform name beside it. */
export function Wordmark({
  href = "/",
  tone = "ink",
  size = "md",
}: {
  href?: string;
  tone?: "ink" | "light";
  size?: "sm" | "md";
}) {
  return (
    <Link
      href={href}
      className={`flex items-baseline gap-2 tracking-tight ${tone === "light" ? "text-white" : ""}`}
    >
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-3.5 w-3.5 rotate-12 rounded-[3px] bg-amber"
          aria-hidden="true"
        />
        <span className={`font-extrabold ${size === "sm" ? "text-lg" : "text-[22px]"}`}>
          {BRAND.platformLead}
        </span>
      </span>
      <span className={`font-medium ${tone === "light" ? "text-[#A9C7C1]" : "text-muted"} ${size === "sm" ? "text-xs" : "text-sm"}`}>
        {BRAND.platformTail}
      </span>
    </Link>
  );
}
