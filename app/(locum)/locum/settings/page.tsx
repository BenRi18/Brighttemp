import { requireLocum } from "@/features/auth/session";
import { LocumSettingsForm } from "@/features/locums/components/settings-form";
import { PageHeading } from "@/components/layout/portal-shell";

export default async function LocumSettingsPage() {
  const { locum } = await requireLocum();
  return (
    <>
      <PageHeading title="Your profile" lede="What practices see when you come up in a search." />
      <LocumSettingsForm locum={locum} />
    </>
  );
}
