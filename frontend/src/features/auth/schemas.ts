import { z } from 'zod';

// New owner accounts choose 6 digits; staff get a 4-digit PIN from the owner.
export const PIN_LENGTH = 6;
export const STAFF_PIN_LENGTH = 4;

/** Shop app: owner and staff PINs have 6 digits. */
export const SHOP_PIN_LENGTH = 6;

const phone = z.string().regex(/^[79]\d{8}$/, 'auth.errors.phone');
const pin = z.string().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), 'auth.errors.pin');

export const signInSchema = z.object({
  phone,
  pin: z
    .string()
    .regex(new RegExp(`^\\d{${STAFF_PIN_LENGTH},${PIN_LENGTH}}$`), 'auth.errors.signInPin'),
  rememberMe: z.boolean(),
});

const emailOk = (value: string) => z.email().max(254).safeParse(value.trim()).success;
const signInPinOk = (value: string) =>
  new RegExp(`^\\d{${STAFF_PIN_LENGTH},${PIN_LENGTH}}$`).test(value);

/**
 * The Sign in form has two modes: owner / manager (email + PIN) and staff (phone + PIN). Only the
 * fields of the chosen mode are checked.
 */
export const signInFormSchema = z
  .object({
    mode: z.enum(['owner', 'staff']),
    email: z.string(),
    phone: z.string(),
    pin: z.string(),
    rememberMe: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const fail = (path: 'email' | 'phone' | 'pin', message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (v.mode === 'owner' && !emailOk(v.email)) fail('email', 'auth.errors.email');
    if (v.mode === 'staff' && !/^[79]\d{8}$/.test(v.phone)) fail('phone', 'auth.errors.phone');
    if (!signInPinOk(v.pin)) fail('pin', 'auth.errors.signInPin');
  });

export const createAccountSchema = z.object({
  fullName: z.string().trim().min(2, 'auth.errors.fullName'),
  businessName: z.string().trim().min(2, 'auth.errors.businessName'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('auth.errors.email').max(254, 'auth.errors.email')),
  phone,
  pin,
  acceptTerms: z.boolean().refine((v) => v, 'auth.errors.terms'),
});

/** Shop app sign-up: no email. The phone is the 9 digits after +251. */
export const createShopAccountSchema = z.object({
  fullName: z.string().trim().min(2, 'auth.errors.fullName'),
  businessName: z.string().trim().min(2, 'auth.errors.shopName'),
  phone: z.string().regex(/^[79]\d{8}$/, 'auth.errors.phoneShop'),
  pin: z.string().regex(new RegExp(`^\\d{${SHOP_PIN_LENGTH}}$`), 'auth.errors.pin'),
  acceptTerms: z.boolean().refine((v) => v, 'auth.errors.terms'),
});
export type CreateShopAccountValues = z.infer<typeof createShopAccountSchema>;

export type SignInValues = z.infer<typeof signInSchema>;
export type SignInFormValues = z.infer<typeof signInFormSchema>;
export type CreateAccountValues = z.infer<typeof createAccountSchema>;
