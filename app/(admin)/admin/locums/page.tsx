import Link from "next/link";
import {
  listLocums,
  allRoles,
  ACCOUNT_STATUSES,
  DORMANT_AFTER_DAYS,
  isDormant,
} from "@/features/locums/queries";
import { PageHeading } from "@/components/layout/portal-shell";
import { AccountBadge, Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/form";
import { stampDate } from "@/lib/format";
import type { AccountStatus } from "@/lib/database.types";

export const metadata = { title: "Locums — Brighttemp admin" };

type Search = {
  q?: string;
  role?: string;
  status?: string;
  bookable?: string;
  activity?: string;
  archived?: string;
  /** Set by the redirect after a successful deletion. */
  removed?: string;
};

/**
 * The roster: everyone on the books, not just the ones waiting for a decision.
 * Approvals deals with the queue; this is for looking someone up afterwards.
 */
export default async function AdminLocumsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const showArchived = sp.archived === "yes";
  const [{ rows, truncated, activityKnown }, roles] = await Promise.all([
    listLocums({
      q: sp.q,
      roleId: sp.role,
      status: sp.status,
      bookable: sp.bookable,
      activity: sp.activity,
      includeArchived: showArchived,
    }),
    allRoles(),
  ]);

  const filtered = Boolean(
    sp.q || sp.role || sp.status || sp.bookable || sp.activity || showArchived,
  );
  const bookable = rows.filter((r) => r.isBookable).length;
  const dormant = activityKnown
    ? rows.filter((r) => !r.archivedAt && isDormant(r)).length
    : 0;

  const select =
    "rounded-lg border border-line bg-white px-3 py-2 text-sm text-[#12211F] outline-none focus-visible:ring-2 focus-visible:ring-amber";

  return (
    <>
      <PageHeading
        title="Locums"
        lede="Everyone registered, whatever their status. Search by name, email or GDC number."
      />

      {/* A plain GET form: the filters live in the URL, so a search can be
          bookmarked or sent to a colleague. */}
      <form className="mb-6 flex flex-wrap gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Name, email or GDC number"
          aria-label="Search locums"
          className="min-w-[16rem] flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber"
        />
        <select name="role" defaultValue={sp.role ?? ""} aria-label="Role" className={select}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={select}>
          <option value="">Any status</option>
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          name="bookable"
          defaultValue={sp.bookable ?? ""}
          aria-label="Appears in search"
          className={select}
        >
          <option value="">In search or not</option>
          <option value="yes">In search</option>
          <option value="no">Not in search</option>
        </select>
        {activityKnown ? (
          <select
            name="activity"
            defaultValue={sp.activity ?? ""}
            aria-label="Activity"
            className={select}
          >
            <option value="">Any activity</option>
            <option value="dormant">Dormant — never booked, no recent sign-in</option>
          </select>
        ) : null}
        <label className="flex items-center gap-2 self-center text-sm text-muted">
          <input
            type="checkbox"
            name="archived"
            value="yes"
            defaultChecked={showArchived}
            className="h-4 w-4 rounded border-line"
          />
          Show archived
        </label>
        <button className="rounded-full bg-pine px-5 py-2 text-sm font-semibold text-white">
          Apply
        </button>
        {filtered ? (
          <Link
            href="/admin/locums"
            className="self-center text-sm font-semibold text-muted underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {sp.removed ? (
        <div className="mb-4">
          <Banner tone="success">
            {sp.removed} has been deleted — account, login and uploaded documents.
          </Banner>
        </div>
      ) : null}

      <p className="mb-4 text-sm text-muted">
        {rows.length} {rows.length === 1 ? "locum" : "locums"}
        {rows.length > 0 ? ` · ${bookable} currently in practice search` : ""}
        {dormant > 0 && sp.activity !== "dormant" ? (
          <>
            {" · "}
            <Link href="/admin/locums?activity=dormant" className="underline">
              {dormant} dormant
            </Link>
          </>
        ) : null}
        {truncated ? " · showing the first 500, narrow the filters to see more" : ""}
      </p>

      {sp.activity === "dormant" ? (
        <p className="mb-4 rounded-lg border border-line bg-[#F7F4EC] px-4 py-3 text-sm text-muted">
          Never had a booking, and either never signed in or not for{" "}
          {DORMANT_AFTER_DAYS} days. Nothing is lost by deleting these — open one
          to do it.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-white px-5 py-8 text-center text-muted">
          {filtered ? "No locum matches those filters." : "Nobody has registered yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[58rem] text-sm">
            <thead>
              <tr className="bg-[#EAF0EA] text-left text-muted">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Based</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Documents</th>
                {activityKnown ? (
                  <th className="px-4 py-3 font-semibold">Last sign-in</th>
                ) : null}
                <th className="px-4 py-3 font-semibold">Bookings</th>
                <th className="px-4 py-3 font-semibold">In search</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/locums/${r.id}`} className="font-semibold underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.email}
                      {r.gdcNumber ? ` · GDC ${r.gdcNumber}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.role}
                    <div className="text-xs text-muted">{r.yearsExperience} yrs</div>
                  </td>
                  <td className="px-4 py-3">{r.basePostcode}</td>
                  <td className="px-4 py-3">
                    <AccountBadge status={r.status as AccountStatus} />
                    {r.archivedAt ? (
                      <div className="mt-1">
                        <Badge tone="neutral">Archived</Badge>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentSummary compliance={r.compliance} />
                  </td>
                  {activityKnown ? (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.lastSeenAt ? (
                        stampDate(r.lastSeenAt)
                      ) : (
                        <span className="text-muted">Never</span>
                      )}
                      {!r.archivedAt && isDormant(r) ? (
                        <div className="mt-1">
                          <Badge tone="amber">Dormant</Badge>
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    {r.bookings > 0 ? r.bookings : <span className="text-muted">None</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.isBookable ? (
                      <Badge tone="mint">Yes</Badge>
                    ) : (
                      <Badge tone="neutral">No</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Only the things that need attention get a colour. */
function DocumentSummary({
  compliance,
}: {
  compliance: { approved: number; outstanding: number; expiringSoon: number; expired: number };
}) {
  const { approved, outstanding, expiringSoon, expired } = compliance;
  if (approved + outstanding + expiringSoon + expired === 0) {
    return <span className="text-muted">None uploaded</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {approved > 0 ? <Badge tone="mint">{approved} cleared</Badge> : null}
      {expiringSoon > 0 ? <Badge tone="amber">{expiringSoon} expiring</Badge> : null}
      {expired > 0 ? <Badge tone="red">{expired} expired</Badge> : null}
      {outstanding > 0 ? <Badge tone="amber">{outstanding} to review</Badge> : null}
    </div>
  );
}
