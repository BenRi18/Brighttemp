import { notFound } from "next/navigation";
import { getBooking, getBookingHistory } from "@/features/bookings/queries";
import { BookingActions } from "@/features/bookings/components/booking-actions";
import { BookingBadge } from "@/components/ui/badge";
import { PageHeading } from "@/components/layout/portal-shell";
import { money, shiftDate, shiftTimes, noticeHours } from "@/lib/format";

export default async function LocumBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [booking, history] = await Promise.all([getBooking(id), getBookingHistory(id)]);
  if (!booking) notFound();

  return (
    <>
      <PageHeading title={shiftDate(booking.booking_date)} lede={booking.reference} />

      <div className="mb-6 flex items-center gap-3">
        <BookingBadge status={booking.status} />
        <span className="text-muted">
          {shiftTimes(booking.start_time, booking.finish_time)} · {booking.hours} hours
        </span>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold">Practice</h2>
          <p className="font-semibold">{booking.practices?.name}</p>
          <p className="text-sm text-muted">
            {booking.practices?.city}, {booking.practices?.postcode}
          </p>
          {booking.notes ? <p className="mt-3 text-sm">{booking.notes}</p> : null}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold">Your pay</h2>
          <p className="text-3xl font-extrabold tracking-tight">{money(booking.locum_total)}</p>
          <p className="mt-1 text-sm text-muted">
            {booking.hours} hours at {money(booking.locum_hourly_rate)}/hr
          </p>
          <p className="mt-3 text-xs text-muted">
            Paid directly by the practice. Brighttemp takes nothing from this.
          </p>
        </section>
      </div>

      <div className="mb-6">
        <BookingActions
          bookingId={booking.id}
          status={booking.status}
          viewer="locum"
          noticeHours={noticeHours(booking.booking_date, booking.start_time)}
          cancellationFee={0}
        />
      </div>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 font-bold">History</h2>
        <ol className="space-y-2 text-sm">
          {history.map((h, i) => (
            <li key={i} className="flex justify-between text-muted">
              <span>
                {h.from_status ? `${h.from_status} → ` : ""}
                <span className="font-semibold text-[#12211F]">{h.to_status}</span>
              </span>
              <time>{new Date(h.changed_at).toLocaleString("en-GB")}</time>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
