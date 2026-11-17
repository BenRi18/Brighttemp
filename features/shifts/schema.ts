import { z } from "zod";

/**
 * Nothing about money here. A posted shift carries no rate — each locum
 * offers at their own, and the practice compares them when choosing.
 */
export const postShiftSchema = z
  .object({
    roleId: z.string().uuid({ message: "Choose which role you need" }),
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

export const claimShiftSchema = z.object({
  shiftId: z.string().uuid(),
  message: z.string().trim().max(300).optional().or(z.literal("")),
});

export const shiftIdSchema = z.object({
  shiftId: z.string().uuid(),
});

export const awardShiftSchema = z.object({
  shiftId: z.string().uuid(),
  claimId: z.string().uuid(),
});
