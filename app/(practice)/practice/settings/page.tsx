import { requirePractice } from "@/features/auth/session";
import { listTeam } from "@/features/practices/queries";
import { PracticeSettingsForm } from "@/features/practices/components/settings-form";
import { PageHeading } from "@/components/layout/portal-shell";

export default async function PracticeSettingsPage() {
  const { practice } = await requirePractice();
  const team = await listTeam(practice.practice.id);

  return (
    <>
      <PageHeading title="Practice details" />
      <PracticeSettingsForm practice={practice.practice} canEdit={practice.role !== "staff"} />

      <section className="mt-10 rounded-xl border border-line bg-white p-5">
        <h2 className="mb-4 font-bold">Team</h2>
        <ul className="divide-y divide-line">
          {team.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex-1 font-medium">{m.profiles?.full_name}</span>
              <span className="text-sm text-muted">{m.profiles?.email}</span>
              <span className="text-sm font-semibold">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
