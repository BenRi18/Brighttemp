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

  // Path must start with the locum id — the storage policy keys off it.
  const safeName = file!.name.replace(/[^\w.-]/g, "_").slice(-80);
  const path = `${account.locum.id}/${d.docType}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("compliance")
    .upload(path, file!, { contentType: file!.type, upsert: false });

  if (uploadError) return { error: "We couldn't upload that file. Try again." };

  await supabase
    .from("compliance_documents")
    .update({ is_current: false })
    .eq("locum_id", account.locum.id)
    .eq("doc_type", d.docType)
    .eq("is_current", true);

  const { error } = await supabase.from("compliance_documents").insert({
    locum_id: account.locum.id,
    doc_type: d.docType,
    storage_path: path,
    original_filename: file!.name,
    mime_type: file!.type,
    size_bytes: file!.size,
    issue_date: d.issueDate || null,
    expiry_date: d.expiryDate || null,
    reference: d.reference || null,
  });

  if (error) {
    await supabase.storage.from("compliance").remove([path]);
    return { error: "We couldn't save that document. Try again." };
  }

  revalidatePath("/locum/compliance");
  return { message: "Uploaded. Brighttemp will review it shortly." };
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
  const { error } = await supabase
    .from("compliance_documents")
    .update({
      status: d.decision === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: account.profile.id,
      rejection_reason: d.decision === "reject" ? d.rejectionReason : null,
    })
    .eq("id", d.documentId);

  if (error) return { error: "We couldn't record that decision." };

  revalidatePath("/admin/compliance");
  return { message: d.decision === "approve" ? "Document approved." : "Document rejected." };
}
