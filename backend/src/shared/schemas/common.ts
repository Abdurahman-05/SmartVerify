import { z } from 'zod';

/** 9 digits without +251, starting with 9 or 7 (same rule as the app). */
export const phoneSchema = z.string().regex(/^[79]\d{8}$/);
export const ownerPinSchema = z.string().regex(/^\d{6}$/);
export const staffPinSchema = z.string().regex(/^\d{4}$/);
export const anyPinSchema = z.string().regex(/^\d{4,6}$/);
/** Integer ETB. */
export const etbSchema = z.number().int().nonnegative();
export const idParamSchema = z.object({ id: z.string().min(1).max(64) });
export const periodSchema = z.enum(['today', '7d', '30d']).default('today');

export const roleSchema = z.enum(['owner', 'manager', 'waiter', 'chef']);
export const planSchema = z.enum(['normal', 'restaurant']);

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), details: z.record(z.string(), z.unknown()).optional() }),
});
