import { notFound } from "next/navigation";
import { getBooking, getBookingHistory } from "@/features/bookings/queries";
import { BookingActions } from "@/features/bookings/components/booking-actions";
import { BookingBadge } from "@/components/ui/badge";
import { PageHeading } from "@/components/layout/portal-shell";
import { money, shiftDate, shiftTimes, noticeHours } from "@/lib/format";

export default async function PracticeBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [booking, history] = await Promise.all([getBooking(id), getBookingHistory(id)]);
  if (!booking) notFound();

  const notice = noticeHours(booking.booking_date, booking.start_time);
  const fee = notice < 24 ? 30 : 0; // mirrors the fees table; the RPC is authoritative
  const total =
    Number(booking.locum_total) + Number(booking.booking_fee) + Number(booking.same_day_surcharge);

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
          <h2 className="mb-3 font-bold">Locum</h2>
          <p className="font-semibold">{booking.locums?.profiles?.full_name}</p>
          <p className="text-sm text-muted">
            {booking.roles?.name} · {booking.locums?.years_experience} years&apos; experience
          </p>
          {booking.status === "confirmed" && booking.locums?.profiles?.phone ? (
            <p className="mt-2 text-sm">{booking.locums.profiles.phone}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold">What you pay</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">
                To the locum ({booking.hours}h × {money(booking.locum_hourly_rate)})
              </dt>
              <dd className="font-semibold">{money(booking.locum_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Brighttemp booking fee</dt>
              <dd className="font-semibold">{money(booking.booking_fee)}</dd>
            </div>
            {Number(booking.same_day_surcharge) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Same-day surcharge</dt>
                <dd className="font-semibold">{money(booking.same_day_surcharge)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="font-semibold">Total</dt>
              <dd className="font-bold">{money(total)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            You pay the locum directly. Only the Brighttemp fee is invoiced.
          </p>
        </section>
      </div>

      <div className="mb-6">
        <BookingActions
          bookingId={booking.id}
          status={booking.status}
          viewer="practice"
          noticeHours={notice}
          cancellationFee={fee}
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
