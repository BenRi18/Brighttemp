import { listBookings } from "@/features/bookings/queries";
import { BookingCard } from "@/features/bookings/components/booking-card";
import { PageHeading } from "@/components/layout/portal-shell";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PracticeBookingsPage() {
  const [upcoming, past] = await Promise.all([
    listBookings({ upcoming: true }),
    listBookings({ upcoming: false, limit: 20 }),
  ]);

  return (
    <>
      <PageHeading title="Bookings" lede="Everything requested, confirmed and completed." />

      <h2 className="mb-4 text-lg font-bold">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState
          title="Nothing booked"
          body="Search for cover and your bookings will appear here."
          action={{ href: "/practice/search", label: "Find cover" }}
        />
      ) : (
        <div className="space-y-3">
          {upcoming.map((b) => (
            <BookingCard key={b.id} booking={b} viewer="practice" />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-lg font-bold">Past</h2>
          <div className="space-y-3">
            {past.map((b) => (
              <BookingCard key={b.id} booking={b} viewer="practice" />
            ))}
          </div>
        </>
      )}
    </>
  );
}
