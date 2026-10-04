import { z } from 'zod';

// Sign In design says 4 digits, Create Account says 6. Using 6 until confirmed.
export const PIN_LENGTH = 6;

const phone = z.string().regex(/^[79]\d{8}$/, 'auth.errors.phone');
const pin = z.string().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), 'auth.errors.pin');

export const signInSchema = z.object({
  phone,
  pin,
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
