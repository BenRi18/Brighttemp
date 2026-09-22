import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brighttemp — dental locum cover, booked direct",
  description:
    "Practices book vetted locum dental nurses, hygienists and receptionists. Locums set their own rate and are paid direct.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="bg-[#F4F7F3] text-[#12211F] antialiased">{children}</body>
    </html>
  );
}
