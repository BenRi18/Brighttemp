import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { canonicalUrl } from "@/lib/site-url";
// Self-hosted brand fonts — no request to Google, works offline.
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { DevToolbar } from "@/features/dev/components/dev-toolbar";

const TITLE = `${BRAND.platform} — dental locum cover, booked direct`;
const DESCRIPTION =
  "Practices book locum dental nurses, hygienists, orthodontic therapists and receptionists. Locums set their own rate and are paid direct.";

export const metadata: Metadata = {
  // Without this, Next can't turn relative URLs in the metadata below into
  // absolute ones, and warns on every build.
  metadataBase: new URL(canonicalUrl()),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: BRAND.platform,
    locale: "en_GB",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="bg-[#F4F7F3] font-sans text-[#12211F] antialiased">
        {children}
        <DevToolbar />
      </body>
    </html>
  );
}
