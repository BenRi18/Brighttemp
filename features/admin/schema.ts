import { z } from "zod";

export const approvalSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const rateDecisionSchema = z.object({
  rateId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const feeSchema = z.object({
  roleId: z.string().uuid(),
  dayType: z.enum(["weekday", "weekend", "bank_holiday"]),
  amount: z.coerce.number().min(0).max(1000),
});

/** The two fees that aren't per role: the same-day surcharge and cancellation. */
export const flatFeeSchema = z.object({
  feeType: z.enum(["same_day_surcharge", "cancellation"]),
  amount: z.coerce.number().min(0).max(1000),
  noticeHoursBelow: z.coerce.number().int().min(1).max(336).optional(),
});

export const trustSchema = z.object({
  practiceId: z.string().uuid(),
  trustLevel: z.enum(["new", "trusted"]),
});

export const archiveSchema = z.object({
  locumId: z.string().uuid(),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

/**
 * Deleting is not reversible, so the form has to say so out loud: the
 * confirmation box is part of the payload, not just a disabled button in the
 * browser. The action re-checks eligibility against the database afterwards
 * regardless — this only stops an accidental submit.
 */
export const deleteLocumSchema = z.object({
  locumId: z.string().uuid(),
  confirm: z.literal("delete", {
    errorMap: () => ({ message: "Tick the box to confirm" }),
  }),
});
