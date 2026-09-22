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

export const trustSchema = z.object({
  practiceId: z.string().uuid(),
  trustLevel: z.enum(["new", "trusted"]),
});
