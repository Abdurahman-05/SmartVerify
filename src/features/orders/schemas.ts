import { z } from 'zod';

const phone = z.string().regex(/^0[79]\d{8}$/, 'orders.errors.phone');

export const takeawaySchema = z.object({
  customerName: z.string().trim().min(1, 'orders.errors.customerName'),
  customerPhone: z.union([z.literal(''), phone]),
});

export const deliverySchema = z.object({
  fee: z.string().regex(/^\d{1,4}$/, 'orders.errors.fee'),
  address: z.string().trim().min(2, 'orders.errors.address'),
  customerPhone: phone,
});

export type TakeawayValues = z.infer<typeof takeawaySchema>;
export type DeliveryValues = z.infer<typeof deliverySchema>;

/** First error message per field, as i18n keys. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    out[key] ??= issue.message;
  }
  return out;
}
