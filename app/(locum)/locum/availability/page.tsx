import { requireLocum } from "@/features/auth/session";
import { listAvailability } from "@/features/locums/queries";
import { AvailabilityEditor } from "@/features/locums/components/availability-editor";
import { PageHeading } from "@/components/layout/portal-shell";

export default async function AvailabilityPage() {
  const { locum } = await requireLocum();
  const days = await listAvailability(locum.id, 90);

  return (
    <>
      <PageHeading
        title="Availability"
        lede="Practices can only find you on days you've marked free, and only for shifts that sit inside your hours."
      />
      <AvailabilityEditor days={days} />
    </>
  );
}
