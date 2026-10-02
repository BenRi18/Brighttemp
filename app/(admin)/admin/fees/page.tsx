import { currentFees } from "@/features/admin/queries";
import { listRoles } from "@/features/search/queries";
import { FeeEditor } from "@/features/admin/components/fee-editor";
import { PageHeading } from "@/components/layout/portal-shell";

export default async function FeesPage() {
  const [fees, roles] = await Promise.all([currentFees(), listRoles()]);

  const bookingFees = fees.filter((f) => f.fee_type === "booking");
  const sameDay = fees.find((f) => f.fee_type === "same_day_surcharge");
  const cancellation = fees.find((f) => f.fee_type === "cancellation");
  const lookup = new Map(
    bookingFees.map((f) => [`${f.roles?.id}:${f.day_type}`, Number(f.amount)]),
  );

  return (
    <>
      <PageHeading
        title="Booking fees"
        lede="Set what practices pay Brighttemp per booking. Changing a fee closes the old rate and opens a new one from today, so past bookings keep what they were charged."
      />
      <FeeEditor
        roles={roles}
        lookup={Object.fromEntries(lookup)}
        sameDay={Number(sameDay?.amount ?? 0)}
        cancellation={Number(cancellation?.amount ?? 0)}
        cancellationNoticeHours={Number(cancellation?.notice_hours_below ?? 24)}
      />
    </>
  );
}
