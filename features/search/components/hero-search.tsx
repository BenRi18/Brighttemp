"use client";

import { useState } from "react";
import { money, hourly, addDaysISO, todayISO } from "@/lib/format";

/**
 * Marketing demo only. Signed-out visitors cannot call search_locums — RLS
 * gates it to practice users — so this runs on sample data to show the shape
 * of the result, including the two-part cost. The real search lives at
 * /practice/search.
 */
const SAMPLE = {
  nurse: [
    { name: "Amara O.", rate: 17.5, miles: 4.2, years: 9 },
    { name: "Jade H.", rate: 18.0, miles: 7.8, years: 6 },
    { name: "Priya S.", rate: 19.25, miles: 11.4, years: 14 },
  ],
  hygienist: [
    { name: "Rowan M.", rate: 34.0, miles: 6.1, years: 8 },
    { name: "Elise K.", rate: 36.5, miles: 9.3, years: 12 },
  ],
  reception: [
    { name: "Chloe B.", rate: 13.5, miles: 3.4, years: 5 },
    { name: "Dan F.", rate: 14.25, miles: 8.9, years: 7 },
  ],
};

const FEES = { nurse: { wk: 25, we: 35 }, hygienist: { wk: 30, we: 40 }, reception: { wk: 20, we: 28 } };
const HOURS = 8;

export function HeroSearch() {
  const [role, setRole] = useState<keyof typeof SAMPLE>("nurse");
  const [date, setDate] = useState(addDaysISO(1));
  const [open, setOpen] = useState(false);

  const chosen = new Date(`${date}T00:00:00`);
  const weekend = [0, 6].includes(chosen.getDay());
  const sameDay = date === todayISO();
  const fee = FEES[role][weekend ? "we" : "wk"] + (sameDay ? 10 : 0);

  const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5";

  return (
    <div className="mt-9 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_40px_-30px_rgba(14,59,54,.55)]">
      <div className="flex flex-wrap items-baseline gap-2.5 bg-pine px-5 py-4 text-white">
        <strong className="font-extrabold tracking-tight">Find cover</strong>
        <span className="text-sm text-[#A9C7C1]">Compliant, available locums only</span>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-4">
        <div>
          <label htmlFor="hero-role" className="mb-1.5 block text-sm font-semibold text-muted">Role</label>
          <select id="hero-role" value={role} onChange={(e) => setRole(e.target.value as keyof typeof SAMPLE)} className={field}>
            <option value="nurse">Dental Nurse</option>
            <option value="hygienist">Dental Hygienist</option>
            <option value="reception">Receptionist</option>
          </select>
        </div>
        <div>
          <label htmlFor="hero-date" className="mb-1.5 block text-sm font-semibold text-muted">Date</label>
          <input id="hero-date" type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="hero-pc" className="mb-1.5 block text-sm font-semibold text-muted">Postcode</label>
          <input id="hero-pc" defaultValue="LS1 4DY" className={field} />
        </div>
        <div className="flex items-end">
          <button onClick={() => setOpen(true)} className="h-[46px] w-full rounded-full bg-amber font-semibold text-[#12211F]">
            Find cover
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line px-5 pb-5">
          <p className="border-b border-dashed border-line py-4 text-sm text-muted">
            {chosen.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · 9:00–17:00
            {sameDay ? <span className="ml-2 rounded-full bg-amber px-2.5 py-0.5 text-xs font-semibold text-[#12211F]">Same-day fee applies</span> : null}
          </p>

          {SAMPLE[role].map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-0">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted">
                  {p.years} years · {p.miles} miles · <span className="font-semibold text-mint">All 6 documents clear</span>
                </p>
              </div>
              <div className="text-right text-sm text-muted">
                <span className="block text-lg font-extrabold tracking-tight text-[#12211F]">{hourly(p.rate)}</span>
                {money(p.rate * HOURS)} to the locum + {money(fee)} to Brighttemp
              </div>
            </div>
          ))}

          <p className="pt-4 text-sm text-muted">
            A demonstration. Real availability appears once you have an account.
          </p>
        </div>
      )}
    </div>
  );
}
