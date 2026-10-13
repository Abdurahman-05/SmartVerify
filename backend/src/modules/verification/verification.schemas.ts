import { z } from 'zod';

export const verifyCbeBodySchema = z.object({
  url: z
    .string()
    .min(1)
    .max(500)
    .describe(
      'The CBE receipt link from the QR: https://mbreciept.cbe.com.et/v2-… (mobile banking) ' +
        'or https://apps.cbe.com.et/?id=FT…(+ payer account last 8)'
    ),
  expectedAmountEtb: z.number().int().positive().max(100_000_000),
  billId: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe('The bill being paid; a failed check is saved with it for history'),
});

export const verifiedSchema = z.object({
  status: z.literal('verified'),
  reference: z.string(),
  amountEtb: z.number().int(),
  extraEtb: z.number().int().describe('Paid above the expected amount (0 if exact)'),
  payerName: z.string(),
  receiverName: z.string(),
  date: z.string().describe('Payment time from the receipt (ISO)'),
});

export const notMatchingSchema = z.object({
  status: z.literal('not_matching'),
  reference: z.string(),
  amountEtb: z.number().int().describe('Amount on the receipt'),
  reasons: z.array(z.enum(['WRONG_RECEIVER', 'AMOUNT_TOO_LOW', 'NOT_SUCCESS', 'EXPIRED'])),
});

export const unableSchema = z.object({
  status: z.literal('unable_to_verify'),
  reason: z
    .enum(['TIMEOUT', 'UNREACHABLE', 'NOT_FOUND', 'UNPARSEABLE'])
    .describe('NOT_FOUND: the bank has no receipt for this link'),
});

export const verifyResponseSchema = z.union([verifiedSchema, notMatchingSchema, unableSchema]);

export type VerifyResponse = z.infer<typeof verifyResponseSchema>;

const reasonSchema = z.enum([
  'WRONG_RECEIVER',
  'AMOUNT_TOO_LOW',
  'NOT_SUCCESS',
  'EXPIRED',
  'TIMEOUT',
  'UNREACHABLE',
  'NOT_FOUND',
  'UNPARSEABLE',
]);

export const failedCheckSchema = z.object({
  id: z.string(),
  billId: z.string().nullable(),
  label: z.string().nullable().describe('"Table 12", "Takeaway #1044"; null without a bill'),
  bankCode: z.string(),
  status: z.enum(['not_matching', 'unable_to_verify']),
  reasons: z.array(reasonSchema),
  reference: z.string().nullable(),
  receiptAmountEtb: z.number().int().nullable(),
  expectedAmountEtb: z.number().int(),
  checkedBy: z.string(),
  createdAt: z.string(),
});

export type FailedCheck = z.infer<typeof failedCheckSchema>;
