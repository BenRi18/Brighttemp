import { z } from "zod";

export const requestBookingSchema = z.object({
  locumId: z.string().uuid(),
  roleId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  finishTime: z.string().regex(/^\d{2}:\d{2}$/),
  hourlyRate: z.coerce.number().positive(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().min(3, "Give a brief reason").max(500),
});

export const bookingIdSchema = z.object({ bookingId: z.string().uuid() });

export type RequestBookingInput = z.infer<typeof requestBookingSchema>;
