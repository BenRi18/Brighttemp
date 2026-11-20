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
  // Not every role needs every document. A receptionist is not clinical
  // staff, so only photo ID is compulsory for them — telling them all of it
  // is required would be both wrong and discouraging.
  const optional = checklist.filter((r) => !r.mandatory).length;

  return (
    <>
      <PageHeading
        title="Compliance documents"
        lede={
          optional > 0
            ? "Practices never see these files — only that you're cleared. The ones marked required have to be in date for you to appear in search."
            : "Practices never see these files — only that you're cleared. All of them have to be in date for you to appear in search."
        }
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
              {!row.mandatory ? (
                <span className="rounded-full bg-[#EAF0EA] px-2.5 py-0.5 text-xs font-semibold text-muted">
                  Optional
                </span>
              ) : null}
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

            {row.hint ? <p className="mb-3 text-sm text-muted">{row.hint}</p> : null}

            {row.document?.status === "rejected" && row.document.rejection_reason ? (
              <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">
                {row.document.rejection_reason}
              </p>
            ) : null}

            <UploadForm docType={row.docType} label={row.label} hasExisting={!!row.document}
                        requiresExpiry={row.requiresExpiry} />
          </div>
        ))}
      </div>
    </>
  );
}
