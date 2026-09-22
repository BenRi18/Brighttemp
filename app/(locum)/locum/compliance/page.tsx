import { requireLocum } from "@/features/auth/session";
import { complianceChecklist } from "@/features/compliance/queries";
import { UploadForm } from "@/features/compliance/components/upload-form";
import { DocumentBadge } from "@/components/ui/badge";
import { PageHeading } from "@/components/layout/portal-shell";

export default async function CompliancePage() {
  const { locum } = await requireLocum();
  const checklist = await complianceChecklist(locum.id, locum.role_id);
  const outstanding = checklist.filter(
    (r) => r.mandatory && (!r.document || !["approved", "expiring_soon"].includes(r.document.status)),
  ).length;

  return (
    <>
      <PageHeading
        title="Compliance documents"
        lede="Practices never see these files — only that you're cleared. All of them have to be in date for you to appear in search."
      />

      {outstanding > 0 && (
        <p className="mb-6 rounded-lg border border-[#F0DFA8] bg-[#FFF7E0] px-4 py-3 text-[#54451A]">
          {outstanding} {outstanding === 1 ? "document is" : "documents are"} outstanding.
        </p>
      )}

      <div className="space-y-4">
        {checklist.map((row) => (
          <div key={row.docType} className="rounded-xl border border-line bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="font-bold">{row.label}</h2>
              {row.document ? (
                <DocumentBadge status={row.document.status} />
              ) : (
                <span className="text-sm text-muted">Not uploaded</span>
              )}
              {row.document?.expiry_date ? (
                <span className="text-sm text-muted">
                  Expires {new Date(row.document.expiry_date).toLocaleDateString("en-GB")}
                </span>
              ) : null}
            </div>

            {row.document?.status === "rejected" && row.document.rejection_reason ? (
              <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">
                {row.document.rejection_reason}
              </p>
            ) : null}

            <UploadForm docType={row.docType} label={row.label} hasExisting={!!row.document} />
          </div>
        ))}
      </div>
    </>
  );
}
