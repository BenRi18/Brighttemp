import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F7F3]">
      <header className="border-b border-[#D5DFD8]">
        <div className="mx-auto flex h-[70px] max-w-5xl items-center px-6">
          <Link href="/" className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
            <span className="h-3.5 w-3.5 rotate-12 rounded-[3px] bg-[#FFC93D]" aria-hidden />
            Brighttemp
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
