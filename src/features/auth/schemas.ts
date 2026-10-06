import { z } from 'zod';

// New owner accounts choose 6 digits; staff get a 4-digit PIN from the owner.
export const PIN_LENGTH = 6;
export const STAFF_PIN_LENGTH = 4;

const phone = z.string().regex(/^[79]\d{8}$/, 'auth.errors.phone');
const pin = z.string().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), 'auth.errors.pin');

export const signInSchema = z.object({
  phone,
  pin: z.string().regex(new RegExp(`^\\d{${STAFF_PIN_LENGTH},${PIN_LENGTH}}$`), 'auth.errors.signInPin'),
  rememberMe: z.boolean(),
});

export const createAccountSchema = z.object({
  fullName: z.string().trim().min(2, 'auth.errors.fullName'),
  businessName: z.string().trim().min(2, 'auth.errors.businessName'),
  phone,
  pin,
  acceptTerms: z.boolean().refine((v) => v, 'auth.errors.terms'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type CreateAccountValues = z.infer<typeof createAccountSchema>;
