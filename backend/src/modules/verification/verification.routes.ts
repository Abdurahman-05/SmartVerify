import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { requireRoles } from '../../plugins/auth.js';

import { createVerificationService } from './verification.service.js';
import type { VerificationProvider } from './verification.types.js';

const outcomeSchema = z.union([
  z.object({
    status: z.literal('verified'),
    transactionId: z.string(),
    amount: z.number().int(),
    accountId: z.string(),
    accountName: z.string().nullable(),
    reference: z.string(),
    verifiedAt: z.string(),
  }),
  z.object({
    status: z.literal('failed'),
    reason: z.literal('amountMismatch'),
    transactionId: z.string(),
    expectedAmount: z.number().int(),
    paidAmount: z.number().int(),
    reference: z.string(),
  }),
  z.object({
    status: z.literal('failed'),
    reason: z.literal('duplicate'),
    transactionId: z.string(),
    reference: z.string(),
    firstVerifiedAt: z.string(),
  }),
  z.object({ status: z.literal('failed'), reason: z.enum(['wrongAccount', 'notFound']) }),
  z.object({ status: z.literal('pending') }),
  z.object({
    status: z.literal('unable_to_verify'),
    reason: z.enum(['NO_PROVIDER', 'NO_ACCOUNTS', 'PROVIDER_UNAVAILABLE']),
  }),
]);

export const verificationRoutes =
  (providers: VerificationProvider[]): FastifyPluginAsyncZod =>
  async (app) => {
    const service = createVerificationService(app.prisma, providers);

    app.post(
      '/verifications',
      {
        preHandler: requireRoles('owner', 'manager', 'waiter'),
        schema: {
          tags: ['verification'],
          description:
            'Checks a customer payment against all connected accounts. Returns `unable_to_verify` until an authorised bank provider is integrated; it never reports a payment as verified without one.',
          security: [{ bearerAuth: [] }],
          headers: z.object({ 'idempotency-key': z.string().max(100).optional() }),
          body: z.object({
            expectedAmount: z.number().int().positive(),
            /** Receiving account the user picked. A hint only: all connected accounts are checked. */
            accountId: z.string().optional(),
            input: z.object({
              type: z.enum(['qr', 'ocr', 'sms']),
              raw: z.string().min(1).max(4096),
            }),
          }),
          response: { 200: outcomeSchema },
        },
      },
      async (request) =>
        service.verify(request.auth, {
          expectedAmount: request.body.expectedAmount,
          accountHintId: request.body.accountId,
          evidence: request.body.input,
          idempotencyKey: request.headers['idempotency-key'],
        })
    );
  };
