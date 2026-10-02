import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
// Self-hosted brand fonts — no request to Google, works offline.
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { DevToolbar } from "@/features/dev/components/dev-toolbar";

export const metadata: Metadata = {
  title: `${BRAND.platform} — dental locum cover, booked direct`,
  description:
    "Practices book locum dental nurses, hygienists, orthodontic therapists and receptionists. Locums set their own rate and are paid direct.",
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
