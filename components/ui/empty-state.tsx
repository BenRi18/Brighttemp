import Link from "next/link";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-muted">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-6 inline-block rounded-full bg-pine px-5 py-2.5 font-semibold text-white"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
