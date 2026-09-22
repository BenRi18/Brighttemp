import { z } from "zod";

export const DOC_TYPES = [
  "gdc_registration",
  "dbs",
  "indemnity_insurance",
  "hepatitis_b",
  "cpr_certificate",
  "infection_control",
] as const;

export const DOC_LABELS: Record<(typeof DOC_TYPES)[number], string> = {
  gdc_registration: "GDC registration",
  dbs: "DBS check",
  indemnity_insurance: "Indemnity insurance",
  hepatitis_b: "Hepatitis B evidence",
  cpr_certificate: "CPR certificate",
  infection_control: "Infection control training",
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/heic"];

export const uploadDocumentSchema = z.object({
  docType: z.enum(DOC_TYPES),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  reference: z.string().trim().max(60).optional().or(z.literal("")),
});

export const reviewDocumentSchema = z.object({
  documentId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(500).optional().or(z.literal("")),
});

export function validateFile(file: File | null): string | null {
  if (!file || file.size === 0) return "Choose a file to upload";
  if (file.size > MAX_BYTES) return "That file is larger than 10MB";
  if (!ALLOWED.includes(file.type)) return "Upload a PDF, JPG or PNG";
  return null;
}
