import Link from "next/link";
import { requirePractice } from "@/features/auth/session";
import { listBookings } from "@/features/bookings/queries";
import { BookingCard } from "@/features/bookings/components/booking-card";
import { PageHeading } from "@/components/layout/portal-shell";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PracticeDashboard() {
  const { practice } = await requirePractice();
  const upcoming = await listBookings({ upcoming: true, limit: 5 });

  return (
    <>
      <PageHeading
        title={`Good to see you, ${practice.practice.name}`}
        lede="Your next shifts, and anything waiting on a locum."
      />

      <Link
        href="/practice/search"
        className="mb-10 block rounded-xl bg-pine px-6 py-5 text-white"
      >
        <span className="text-lg font-semibold">Find cover for a shift</span>
        <span className="mt-1 block text-sm text-[#B7D2CC]">
          Search compliant locums by date, distance and rate.
        </span>
      </Link>

      <h2 className="mb-4 text-xl font-bold">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          body="When you book a locum they'll show up here with the shift details and what you'll pay."
          action={{ href: "/practice/search", label: "Find cover" }}
        />
      ) : (
        <div className="space-y-3">
          {upcoming.map((b) => (
            <BookingCard key={b.id} booking={b} viewer="practice" />
          ))}
        </div>
      )}
    </>
  );
}
