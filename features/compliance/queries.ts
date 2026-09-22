import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPES, DOC_LABELS } from "./schema";
import type { ComplianceDocument, Enums } from "@/lib/database.types";

export type ChecklistRow = {
  docType: Enums<"compliance_doc_type">;
  label: string;
  mandatory: boolean;
  document: ComplianceDocument | null;
};

/**
 * The locum's compliance page: every document their role requires, with the
 * current upload against it. Requirements come from the database rather than a
 * hard-coded list, because admins can change them per role.
 */
export async function complianceChecklist(locumId: string, roleId: string): Promise<ChecklistRow[]> {
  const supabase = await createClient();

  const [{ data: requirements }, { data: documents }] = await Promise.all([
    supabase
      .from("compliance_requirements")
      .select("doc_type, is_mandatory")
      .eq("role_id", roleId),
    supabase
      .from("compliance_documents")
      .select("*")
      .eq("locum_id", locumId)
      .eq("is_current", true),
  ]);

  const byType = new Map((documents ?? []).map((d) => [d.doc_type, d]));

  return (requirements ?? [])
    .map((r) => ({
      docType: r.doc_type,
      label: DOC_LABELS[r.doc_type],
      mandatory: r.is_mandatory,
      document: byType.get(r.doc_type) ?? null,
    }))
    .sort((a, b) => DOC_TYPES.indexOf(a.docType) - DOC_TYPES.indexOf(b.docType));
}

/** Admin review queue, oldest first so nobody waits indefinitely. */
export async function pendingDocuments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("compliance_documents")
    .select(`
      id, doc_type, status, uploaded_at, expiry_date, issue_date, reference, storage_path,
      locums ( id, profiles!locums_profile_id_fkey ( full_name, email ), roles ( name ) )
    `)
    .in("status", ["pending", "under_review"])
    .order("uploaded_at", { ascending: true });
  return data ?? [];
}

/** Short-lived link to a private document. Never expose storage paths directly. */
export async function signedDocumentUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("compliance")
    .createSignedUrl(storagePath, 60 * 5);
  return data?.signedUrl ?? null;
}
