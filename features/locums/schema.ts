import { z } from "zod";

export const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isAvailable: z.enum(["true", "false"]).transform((v) => v === "true"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  finishTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export const bulkAvailabilitySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdaysOnly: z.enum(["on", "off"]).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  finishTime: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((d) => d.toDate >= d.fromDate, {
  message: "The end date must be on or after the start date",
  path: ["toDate"],
});

export const rateRequestSchema = z.object({
  weekday: z.coerce.number().positive().max(500),
  weekend: z.coerce.number().positive().max(500),
  bankHoliday: z.coerce.number().positive().max(500),
});

export const locumProfileSchema = z.object({
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  basePostcode: z.string().trim().min(5).max(9),
  travelRadiusMiles: z.coerce.number().int().min(1).max(200),
});
