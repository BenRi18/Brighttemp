import { z } from "zod";

/** Shared password rule. Length beats complexity theatre. */
const password = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "That password is too long");

const email = z.string().trim().toLowerCase().email("Enter a valid email address");

const ukPostcode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/,
    "Enter a valid UK postcode, e.g. LS1 4DY",
  );

const phone = z
  .string()
  .trim()
  .regex(/^(\+44|0)[\d\s]{9,13}$/, "Enter a valid UK phone number")
  .optional()
  .or(z.literal(""));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name").max(120),
    email,
    phone,
    password,
    confirmPassword: z.string(),
    terms: z.literal("on", { errorMap: () => ({ message: "Accept the terms to continue" }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const practiceOnboardingSchema = z.object({
  name: z.string().trim().min(2, "Enter the practice name").max(160),
  tradingName: z.string().trim().max(160).optional().or(z.literal("")),
  addressLine1: z.string().trim().min(2, "Enter the first line of the address"),
  addressLine2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the town or city"),
  postcode: ukPostcode,
  phone,
  billingEmail: email.optional().or(z.literal("")),
  vatNumber: z.string().trim().max(20).optional().or(z.literal("")),
});

export const locumOnboardingSchema = z.object({
  roleId: z.string().uuid("Choose your role"),
  gdcNumber: z.string().trim().max(20).optional().or(z.literal("")),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  basePostcode: ukPostcode,
  travelRadiusMiles: z.coerce.number().int().min(1).max(200),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type PracticeOnboardingInput = z.infer<typeof practiceOnboardingSchema>;
export type LocumOnboardingInput = z.infer<typeof locumOnboardingSchema>;
