import type { ReactNode } from "react";

export function AuthCard({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-[#12211F]">{title}</h1>
      {lede ? <p className="mt-2 text-[#5E7370]">{lede}</p> : null}
      <div className="mt-8">{children}</div>
      {footer ? <div className="mt-6 text-sm text-[#5E7370]">{footer}</div> : null}
    </div>
  );
}

