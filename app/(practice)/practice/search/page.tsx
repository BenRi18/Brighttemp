import { requirePractice } from "@/features/auth/session";
import { listRoles, searchLocums } from "@/features/search/queries";
import { searchSchema } from "@/features/search/schema";
import { SearchForm } from "@/features/search/components/search-form";
import { ResultList } from "@/features/search/components/result-list";
import { favouriteIds } from "@/features/practices/queries";
import { PageHeading } from "@/components/layout/portal-shell";
import { addDaysISO } from "@/lib/format";

/**
 * Search state lives in the URL, not component state — a practice manager can
 * bookmark or share "nurses near us next Tuesday", and back/forward work.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { practice } = await requirePractice();
  const params = await searchParams;
  const roles = await listRoles();

  const parsed = searchSchema.safeParse({
    roleId: params.roleId ?? roles[0]?.id,
    date: params.date ?? addDaysISO(1),
    startTime: params.startTime ?? "09:00",
    finishTime: params.finishTime ?? "17:00",
    maxMiles: params.maxMiles ?? 20,
    minYears: params.minYears ?? 0,
  });

  const outcome = parsed.success ? await searchLocums(practice.practice, parsed.data) : null;
  const favourites = await favouriteIds(practice.practice.id);

  return (
    <>
      <PageHeading
        title="Find cover"
        lede="Only locums who are fully compliant, free on that date and within range appear here."
      />

      <SearchForm roles={roles} defaults={parsed.success ? parsed.data : undefined} />

      <div className="mt-8">
        {!parsed.success && (
          <p className="text-muted">Check the dates and times and search again.</p>
        )}

        {outcome && !outcome.ok && outcome.reason === "no_coordinates" && (
          <p className="rounded-lg border border-[#F0DFA8] bg-[#FFF7E0] px-4 py-3 text-[#54451A]">
            We don&apos;t have map coordinates for your practice postcode, so search can&apos;t
            measure distance. Re-save your postcode in settings to fix it.
          </p>
        )}

        {outcome && outcome.ok && parsed.success && (
          <ResultList
            results={outcome.results}
            search={parsed.data}
            favourites={[...favourites]}
          />
        )}
      </div>
    </>
  );
}
