"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { uploadDocumentSchema, reviewDocumentSchema, validateFile } from "./schema";
import type { ActionState } from "@/features/auth/actions";

/**
 * Upload replaces whatever is currently on file for that document type: the
 * old row is marked not-current so the partial unique index allows the new one,
 * and the history stays intact for audit.
 */
export async function uploadDocument(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = uploadDocumentSchema.safeParse({
    docType: formData.get("docType"),
    issueDate: formData.get("issueDate") ?? "",
    expiryDate: formData.get("expiryDate") ?? "",
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const file = formData.get("file") as File | null;
  const fileError = validateFile(file);
  if (fileError) return { fieldErrors: { file: [fileError] } };

  const account = await requireAccount();
  if (!account.locum) return { error: "Only a locum can upload compliance documents." };

  const supabase = await createClient();
  const d = parsed.data;

  // Does this document expire? The browser hides the field when it doesn't,
  // but that is a convenience, not a rule — the rule is enforced here.
  const { data: requirement } = await supabase
    .from("compliance_requirements")
    .select("requires_expiry")
    .eq("role_id", account.locum.role_id)
    .eq("doc_type", d.docType)
    .maybeSingle();

  const requiresExpiry = requirement?.requires_expiry ?? false;

  if (requiresExpiry && !d.expiryDate) {
    return { fieldErrors: { expiryDate: ["Enter the expiry date shown on the document"] } };
  }

  // A document with no expiry stores none, whatever was posted. Otherwise a
  // stray date would later mark a Hep B record "expired" and quietly drop the
  // locum out of search results.
  const expiryDate = requiresExpiry ? d.expiryDate || null : null;

  // Path must start with the locum id — the storage policy keys off it.
  const safeName = file!.name.replace(/[^\w.-]/g, "_").slice(-80);
  const path = `${account.locum.id}/${d.docType}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("compliance")
    .upload(path, file!, { contentType: file!.type, upsert: false });

  if (uploadError) {
    // The full reason goes to the server log; the locum gets something they
    // can act on. Swallowing this silently made every failure look identical.
    console.error("[uploadDocument] Supabase storage rejected the upload:", {
      bucket: "compliance",
      path,
      size: file!.size,
      type: file!.type,
      message: uploadError.message,
    });
    return { error: storageErrorMessage(uploadError.message) };
  }

  // Archiving the old document and inserting the new one happen together, in
  // the database. Doing it as two statements from here meant the archive could
  // be refused — is_current is not a column a locum may write — and the insert
  // then collided with the one-current-document-per-type index.
  const { error } = await supabase.rpc("replace_compliance_document", {
    p_doc_type: d.docType,
    p_storage_path: path,
    p_original_filename: file!.name,
    p_mime_type: file!.type,
    p_size_bytes: file!.size,
    p_issue_date: d.issueDate || null,
    p_expiry_date: expiryDate,
    p_reference: d.reference || null,
  });

  if (error) {
    // This used to fail silently, which is why a re-upload looked like a
    // mystery. The detail goes to the server log.
    console.error("[uploadDocument] could not record the document:", {
      docType: d.docType,
      path,
      code: error.code,
      message: error.message,
    });
    await supabase.storage.from("compliance").remove([path]);
    return { error: saveErrorMessage(error.message) };
  }

  revalidatePath("/locum/compliance");
  return { message: "Uploaded. Brighttemp will review it shortly." };
}

/** Failures recording the document, in words a locum can act on. */
function saveErrorMessage(message: string): string {
  if (/could not find the function|does not exist|schema cache/i.test(message)) {
    return "This site is missing a database update — please let Brighttemp know.";
  }
  if (/duplicate key|compliance_documents_current_idx/i.test(message)) {
    return "That document was already replaced. Refresh the page to see the latest one.";
  }
  if (/permission denied|not authorised|only a locum/i.test(message)) {
    return "Your account can't upload documents. Sign out and back in, then try again.";
  }
  return "We couldn't save that document. Try again.";
}

/** Storage failures, in words a locum or an admin can act on. */
function storageErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) {
    return "Document storage isn't set up yet. Please contact Brighttemp — this one is on us, not you.";
  }
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("not authorized")) {
    return "You don't have permission to upload that. Try signing out and back in, and contact us if it continues.";
  }
  if (m.includes("exceeded") || m.includes("too large") || m.includes("payload")) {
    return "That file is too large. The limit is 10MB.";
  }
  if (m.includes("mime") || m.includes("content type")) {
    return "That file type isn't accepted. Upload a PDF, JPG or PNG.";
  }
  if (m.includes("duplicate") || m.includes("already exists")) {
    return "That file has already been uploaded. Refresh the page to see it.";
  }
  return process.env.NODE_ENV === "development"
    ? `Upload failed: ${message}`
    : "We couldn't upload that file. Try again, and contact us if it keeps happening.";
}

/**
 * Admin approve/reject. Approving re-runs the bookability trigger, which is
 * what puts a locum into search — there is no separate "activate" step.
 */
export async function reviewDocument(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reviewDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await requireAccount();
  if (!account.admin) return { error: "Not authorised." };

  const d = parsed.data;
  if (d.decision === "reject" && !d.rejectionReason) {
    return { fieldErrors: { rejectionReason: ["Tell the locum what to fix"] } };
  }

  const supabase = await createClient();

  // Admin-only database function: the review columns are not writable by the
  // authenticated role (see 0009_admin_review_functions.sql).
  const { error } = await supabase.rpc("admin_review_document", {
    p_document_id: d.documentId,
    p_approve: d.decision === "approve",
    p_reason: d.rejectionReason || null,
  });

  if (error) {
    console.error("[reviewDocument] failed:", error.message);
    return {
      error: /could not find the function|does not exist|schema cache/i.test(error.message)
        ? "The database is missing an update — run migration 0009_admin_review_functions.sql in Supabase."
        : /not authorised|permission denied/i.test(error.message)
          ? "Your account doesn't have permission to review documents."
          : "We couldn't record that decision. Try again.",
    };
  }

  revalidatePath("/admin/compliance");
  return { message: d.decision === "approve" ? "Document approved." : "Document rejected." };
}
