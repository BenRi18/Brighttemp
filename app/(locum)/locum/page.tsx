import { requireLocum } from "@/features/auth/session";
import { listBookings } from "@/features/bookings/queries";
import { BookingCard } from "@/features/bookings/components/booking-card";
import { PageHeading } from "@/components/layout/portal-shell";
import { EmptyState } from "@/components/ui/empty-state";

export default async function LocumDashboard() {
  const { locum } = await requireLocum();
  const bookings = await listBookings({ upcoming: true });
  const requests = bookings.filter((b) => b.status === "requested");
  const confirmed = bookings.filter((b) => b.status !== "requested");

  return (
    <>
      <PageHeading title="Your shifts" />

      {!locum.is_bookable && (
        <div className="mb-8 rounded-xl border border-[#F0DFA8] bg-[#FFF7E0] px-5 py-4 text-[#54451A]">
          <p className="font-semibold">You aren&apos;t appearing in searches yet.</p>
          <p className="mt-1 text-sm">
            {locum.status === "approved"
              ? "One or more of your compliance documents is missing, expired or still being reviewed."
              : "Brighttemp is still reviewing your account."}
          </p>
        </div>
      )}

      {requests.length > 0 && (
        <>
          <h2 className="mb-4 text-lg font-bold">Waiting on you</h2>
          <div className="mb-10 space-y-3">
            {requests.map((b) => (
              <BookingCard key={b.id} booking={b} viewer="locum" />
            ))}
          </div>
        </>
      )}

      <h2 className="mb-4 text-lg font-bold">Coming up</h2>
      {confirmed.length === 0 ? (
        <EmptyState
          title="No shifts booked"
          body="Keep your availability up to date — practices can only find you on days you've marked free."
          action={{ href: "/locum/availability", label: "Set availability" }}
        />
      ) : (
        <div className="space-y-3">
          {confirmed.map((b) => (
            <BookingCard key={b.id} booking={b} viewer="locum" />
          ))}
        </div>
      )}
    </>
  );
}
