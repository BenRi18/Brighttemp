import { pendingDocuments } from "@/features/compliance/queries";
import { DocumentReview } from "@/features/compliance/components/document-review";
import { PageHeading } from "@/components/layout/portal-shell";
import { DOC_LABELS } from "@/features/compliance/schema";

export default async function AdminCompliancePage() {
  const documents = await pendingDocuments();

  return (
    <>
      <PageHeading
        title="Document review"
        lede="Approving the last outstanding document is what puts a locum into search."
      />

      {documents.length === 0 ? (
        <p className="text-muted">Nothing waiting for review.</p>
      ) : (
        <div className="space-y-3">
          {documents.map((d) => (
            <DocumentReview
              key={d.id}
              documentId={d.id}
              storagePath={d.storage_path}
              label={DOC_LABELS[d.doc_type]}
              locumName={d.locums?.profiles?.full_name ?? "Unnamed"}
              roleName={d.locums?.roles?.name ?? ""}
              expiryDate={d.expiry_date}
              reference={d.reference}
            />
          ))}
        </div>
      )}
    </>
  );
}
