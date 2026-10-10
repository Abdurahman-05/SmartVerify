import { z } from 'zod';

/** 9 digits without +251, starting with 9 or 7 (same rule as the app). */
export const phoneSchema = z.string().regex(/^[79]\d{8}$/);
/** Owner PIN, chosen at Create Account. */
export const ownerPinSchema = z.string().regex(/^\d{6}$/);
/** Sign-in accepts the owner's 6-digit or a staff member's 4-digit PIN. */
export const anyPinSchema = z.string().regex(/^\d{4,6}$/);

export const roleSchema = z.enum(['owner', 'manager', 'waiter', 'chef']);
export const planSchema = z.enum(['normal', 'restaurant']);

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), details: z.record(z.string(), z.unknown()).optional() }),
});
