import { z } from "zod";

export const practiceSettingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  tradingName: z.string().trim().max(160).optional().or(z.literal("")),
  addressLine1: z.string().trim().min(2),
  addressLine2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(2),
  postcode: z.string().trim().min(5).max(9),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  billingEmail: z.string().trim().email().optional().or(z.literal("")),
  vatNumber: z.string().trim().max(20).optional().or(z.literal("")),
});

export const favouriteSchema = z.object({
  locumId: z.string().uuid(),
  action: z.enum(["add", "remove"]),
});
