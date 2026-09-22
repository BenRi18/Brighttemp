"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { SearchInput } from "../schema";

type Role = { id: string; name: string; slug: string };

export function SearchForm({
  roles,
  defaults,
}: {
  roles: Role[];
  defaults?: SearchInput;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);

  function submit(formData: FormData) {
    setPending(true);
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of formData.entries()) next.set(k, String(v));
    router.push(`/practice/search?${next.toString()}`);
    setPending(false);
  }

  const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-amber";
  const label = "mb-1.5 block text-sm font-semibold text-muted";

  return (
    <form action={submit} className="rounded-xl border border-line bg-white p-5">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="roleId" className={label}>Role</label>
          <select id="roleId" name="roleId" defaultValue={defaults?.roleId} className={field}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date" className={label}>Date</label>
          <input id="date" name="date" type="date" defaultValue={defaults?.date} className={field} />
        </div>
        <div>
          <label htmlFor="startTime" className={label}>From</label>
          <input id="startTime" name="startTime" type="time" defaultValue={defaults?.startTime} className={field} />
        </div>
        <div>
          <label htmlFor="finishTime" className={label}>To</label>
          <input id="finishTime" name="finishTime" type="time" defaultValue={defaults?.finishTime} className={field} />
        </div>
        <div>
          <label htmlFor="maxMiles" className={label}>Within</label>
          <select id="maxMiles" name="maxMiles" defaultValue={String(defaults?.maxMiles ?? 20)} className={field}>
            {[5, 10, 20, 35, 50].map((m) => (
              <option key={m} value={m}>{m} miles</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="w-40">
          <label htmlFor="minYears" className={label}>Min. experience</label>
          <select id="minYears" name="minYears" defaultValue={String(defaults?.minYears ?? 0)} className={field}>
            {[0, 2, 5, 10].map((y) => (
              <option key={y} value={y}>{y === 0 ? "Any" : `${y}+ years`}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-amber px-6 py-3 font-semibold text-[#12211F] disabled:opacity-60"
        >
          {pending ? "Searching…" : "Find cover"}
        </button>
      </div>
    </form>
  );
}
