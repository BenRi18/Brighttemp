import { Wordmark } from "@/components/layout/wordmark";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F7F3]">
      <header className="border-b border-[#D5DFD8]">
        <div className="mx-auto flex h-[70px] max-w-5xl items-center px-6">
          <Wordmark />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
