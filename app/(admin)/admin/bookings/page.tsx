import { listBookings } from "@/features/bookings/queries";
import { BookingBadge } from "@/components/ui/badge";
import { PageHeading } from "@/components/layout/portal-shell";
import { money, shiftDate, shiftTimes } from "@/lib/format";

export default async function AdminBookingsPage() {
  const bookings = await listBookings({ upcoming: true, limit: 100 });

  return (
    <>
      <PageHeading title="Bookings" lede="Everything on the platform, soonest first." />

      {bookings.length === 0 ? (
        <p className="text-muted">No upcoming bookings.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-[#EAF0EA] text-left text-muted">
                <th className="px-4 py-3 font-semibold">Ref</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Practice</th>
                <th className="px-4 py-3 font-semibold">Locum</th>
                <th className="px-4 py-3 font-semibold">Fee</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs">{b.reference}</td>
                  <td className="px-4 py-3">
                    {shiftDate(b.booking_date)}
                    <span className="block text-xs text-muted">
                      {shiftTimes(b.start_time, b.finish_time)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{b.practices?.name}</td>
                  <td className="px-4 py-3">{b.locums?.profiles?.full_name}</td>
                  <td className="px-4 py-3 font-semibold">
                    {money(Number(b.booking_fee) + Number(b.same_day_surcharge))}
                  </td>
                  <td className="px-4 py-3">
                    <BookingBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
