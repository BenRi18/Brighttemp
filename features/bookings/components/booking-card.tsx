import Link from "next/link";
import { BookingBadge } from "@/components/ui/badge";
import { money, shiftDate, shiftTimes } from "@/lib/format";
import type { BookingListItem } from "../queries";

export function BookingCard({
  booking,
  viewer,
}: {
  booking: BookingListItem;
  viewer: "practice" | "locum" | "admin";
}) {
  const counterparty =
    viewer === "practice"
      ? booking.locums?.profiles?.full_name
      : booking.practices?.name;

  const href =
    viewer === "practice"
      ? `/practice/bookings/${booking.id}`
      : `/locum/bookings/${booking.id}`;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-line bg-white p-4 hover:border-pine"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{shiftDate(booking.booking_date)}</p>
            <BookingBadge status={booking.status} />
            {booking.is_same_day ? (
              <span className="rounded-full bg-[#FFF7E0] px-2 py-0.5 text-xs font-semibold text-[#54451A]">
                Same day
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {shiftTimes(booking.start_time, booking.finish_time)} · {booking.roles?.name}
            {counterparty ? ` · ${counterparty}` : ""}
          </p>
        </div>

        <div className="text-right text-sm">
          {viewer === "locum" ? (
            <p className="font-bold">{money(booking.locum_total)}</p>
          ) : (
            <>
              <p className="font-bold">
                {money(
                  Number(booking.locum_total) +
                    Number(booking.booking_fee) +
                    Number(booking.same_day_surcharge),
                )}
              </p>
              <p className="text-muted">
                {money(booking.locum_total)} + {money(Number(booking.booking_fee) + Number(booking.same_day_surcharge))} fee
              </p>
            </>
          )}
          <p className="text-xs text-muted">{booking.reference}</p>
        </div>
      </div>
    </Link>
  );
}
