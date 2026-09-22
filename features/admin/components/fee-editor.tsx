"use client";

import { useActionState } from "react";
import { updateFee } from "@/features/admin/actions";
import type { ActionState } from "@/features/auth/actions";
import { Banner } from "@/components/ui/form";

const DAY_TYPES = [
  { value: "weekday", label: "Weekday" },
  { value: "weekend", label: "Weekend" },
  { value: "bank_holiday", label: "Bank holiday" },
] as const;

export function FeeEditor({
  roles,
  lookup,
}: {
  roles: { id: string; name: string }[];
  lookup: Record<string, number>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateFee, {});

  return (
    <>
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.message ? <Banner tone="success">{state.message}</Banner> : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-[#EAF0EA] text-left text-sm text-muted">
              <th className="px-4 py-3 font-semibold">Role</th>
              {DAY_TYPES.map((d) => (
                <th key={d.value} className="px-4 py-3 font-semibold">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{role.name}</td>
                {DAY_TYPES.map((d) => (
                  <td key={d.value} className="px-4 py-3">
                    <form action={action} className="flex items-center gap-2">
                      <input type="hidden" name="roleId" value={role.id} />
                      <input type="hidden" name="dayType" value={d.value} />
                      <span className="text-muted">£</span>
                      <input
                        name="amount"
                        type="number"
                        step="0.50"
                        min="0"
                        defaultValue={lookup[`${role.id}:${d.value}`] ?? 0}
                        className="w-24 rounded-lg border border-line px-2 py-1.5"
                      />
                      <button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-pine">
                        Save
                      </button>
                    </form>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
