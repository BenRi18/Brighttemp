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

/**
 * A practice Brighttemp keeps the books for. Same fields a practice gives at
 * registration, minus everything to do with having a login.
 */
export const managedPracticeSchema = z.object({
  name: z.string().trim().min(2, { message: "Enter the practice name" }).max(120),
  addressLine1: z.string().trim().min(2, { message: "Enter the address" }).max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2, { message: "Enter the town or city" }).max(80),
  postcode: z.string().trim().min(5, { message: "Enter the postcode" }).max(10),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email({ message: "That doesn't look like an email address" })
    .optional()
    .or(z.literal("")),
});

/** Same shape as a practice posting one, plus which practice it is for. */
export const adminPostShiftSchema = z
  .object({
    practiceId: z.string().uuid({ message: "Choose which practice it's for" }),
    roleId: z.string().uuid({ message: "Choose which role they need" }),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Choose a date" }),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Start time, e.g. 09:00" }),
    finishTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Finish time, e.g. 17:00" }),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.finishTime > v.startTime, {
    path: ["finishTime"],
    message: "Finish has to be after the start",
  })
  .refine((v) => v.shiftDate >= new Date().toISOString().slice(0, 10), {
    path: ["shiftDate"],
    message: "That date has passed",
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
