import { z } from "zod";

export const searchSchema = z
  .object({
    roleId: z.string().uuid("Choose a role"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    finishTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a finish time"),
    maxMiles: z.coerce.number().int().min(1).max(200).default(20),
    minYears: z.coerce.number().int().min(0).max(40).default(0),
  })
  .refine((d) => d.finishTime > d.startTime, {
    message: "The finish time must be after the start time",
    path: ["finishTime"],
  });

export type SearchInput = z.infer<typeof searchSchema>;
