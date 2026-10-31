import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma, type BillingPeriod, type Plan } from '../../generated/prisma/client.js';
import { requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema, planSchema } from '../../shared/schemas/common.js';
import { forgetAccess, startPaidPeriod } from '../../services/business-access.js';
import { addMonths, getSettings, planPricing } from '../../services/platform-settings.js';
import { subscriptionSchema } from '../auth/session-user.js';
import { verifyResponseSchema } from '../verification/verification.schemas.js';
import {
  BOA_RECEIPT_ID,
  DASHEN_REFERENCE,
  EBIRR_REFERENCE,
  MPESA_NUMBER,
  TELEBIRR_NUMBER,
  verifyBoa,
  verifyCbe,
  verifyDashen,
  verifyEbirr,
  verifyMpesa,
  verifyTelebirr,
} from '../verification/verification.service.js';

/** The other banks a plan can be paid from: same check as for a business, against our accounts. */
const OTHER_BANKS = {
  DAS: { verify: verifyDashen, format: DASHEN_REFERENCE, method: 'dashen', caseSensitive: false },
  BOA: { verify: verifyBoa, format: BOA_RECEIPT_ID, method: 'boa', caseSensitive: false },
  MPE: { verify: verifyMpesa, format: MPESA_NUMBER, method: 'mpesa', caseSensitive: false },
  EBR: { verify: verifyEbirr, format: EBIRR_REFERENCE, method: 'ebirr', caseSensitive: true },
} as const;
type OtherBank = keyof typeof OTHER_BANKS;

const toSubscription = (s: {
  plan: Plan;
  period: BillingPeriod;
  priceEtb: number;
  startedAt: Date;
  endsAt: Date;
}) => ({
  plan: s.plan,
  period: s.period,
  priceEtb: s.priceEtb,
  startedAt: s.startedAt.toISOString(),
  endsAt: s.endsAt.toISOString(),
});

const errors = {
  400: errorResponseSchema.describe('VALIDATION_ERROR'),
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  403: errorResponseSchema.describe('FORBIDDEN (owner only)'),
};

/** Plans that can be paid for 3 months at once. */
const hasQuarterly = (plan: Plan) => plan === 'normal' || plan === 'restaurant_normal';

/** The business plan. Owner only: staff share the owner's plan. */
export const subscriptionRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma, env } = app;
  const allowUnpaid =
    env.ALLOW_UNPAID_SUBSCRIPTIONS === 'true' ||
    (env.ALLOW_UNPAID_SUBSCRIPTIONS === undefined && env.NODE_ENV !== 'production');

  app.patch(
    '/business/plan',
    {
      preHandler: requireRoles('owner'),
      schema: {
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        description:
          'Choose Plan "Explore": sets the plan the business explores without paying. ' +
          'Staff get the new plan on their next request.',
        body: z.object({ plan: planSchema }),
        response: { 200: z.object({ plan: planSchema }), ...errors },
      },
    },
    async (request) => {
      await prisma.business.update({
        where: { id: request.auth.businessId },
        data: { plan: request.body.plan },
      });
      return { plan: request.body.plan };
    }
  );

  app.post(
    '/subscription',
    {
      preHandler: requireRoles('owner'),
      schema: {
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        description:
          'Starts a subscription right away. NO PAYMENT STEP YET: refused in production unless ' +
          'ALLOW_UNPAID_SUBSCRIPTIONS=true. Normal (owner + 2 workers): monthly or quarterly; ' +
          'Normal Multi (any number of workers) and Restaurant Plus: monthly only. Replaces the current subscription. ' +
          'Repeating an Idempotency-Key returns the first subscription.',
        headers: z.object({
          'idempotency-key': z.string().min(8).max(100).describe('A new UUID per user action'),
        }),
        body: z.object({
          plan: planSchema,
          period: z
            .enum(['monthly', 'quarterly'])
            .describe('Only Normal can be quarterly; the others are always monthly'),
        }),
        response: {
          201: subscriptionSchema,
          ...errors,
          501: errorResponseSchema.describe('PAYMENT_NOT_CONFIGURED'),
        },
      },
    },
    async (request, reply) => {
      if (!allowUnpaid) throw new AppError('PAYMENT_NOT_CONFIGURED');
      const { businessId } = request.auth;
      const { plan } = request.body;
      const period: BillingPeriod = hasQuarterly(plan) ? request.body.period : 'monthly';
      const pricing = planPricing(await getSettings(prisma), plan, period);
      if (!pricing) throw new AppError('VALIDATION_ERROR');
      const idempotencyKey = request.headers['idempotency-key'];

      const replay = () =>
        prisma.subscription.findUnique({
          where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
        });
      const existing = await replay();
      if (existing) return reply.status(201).send(toSubscription(existing));

      const startedAt = new Date();
      try {
        const subscription = await prisma.$transaction(async (tx) => {
          // One active subscription at a time: the new one replaces the old one.
          await tx.subscription.updateMany({
            where: { businessId, status: 'active' },
            data: { status: 'cancelled' },
          });
          await tx.business.update({ where: { id: businessId }, data: { plan } });
          return tx.subscription.create({
            data: {
              businessId,
              plan,
              period,
              priceEtb: pricing.priceEtb,
              startedAt,
              endsAt: addMonths(startedAt, pricing.months),
              idempotencyKey,
              paymentMethod: 'free',
            },
          });
        });
        forgetAccess(businessId);
        return reply.status(201).send(toSubscription(subscription));
      } catch (error) {
        // The same request arrived twice at once: return the one that was saved.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const winner = await replay();
          if (winner) return reply.status(201).send(toSubscription(winner));
        }
        throw error;
      }
    }
  );

  /** Smart Verify's CBE account for plan payments, when configured. */
  const payTo =
    env.SUBSCRIPTION_CBE_ACCOUNT && env.SUBSCRIPTION_CBE_NAME
      ? { accountNumber: env.SUBSCRIPTION_CBE_ACCOUNT, accountName: env.SUBSCRIPTION_CBE_NAME }
      : null;
  /** Smart Verify's telebirr for plan payments, when configured. */
  const payToTelebirr =
    env.SUBSCRIPTION_TELEBIRR && env.SUBSCRIPTION_TELEBIRR_NAME
      ? { number: env.SUBSCRIPTION_TELEBIRR, name: env.SUBSCRIPTION_TELEBIRR_NAME }
      : null;

  app.get(
    '/subscription/payment-info',
    {
      preHandler: requireRoles('owner'),
      schema: {
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        description:
          'Where to pay for a plan (Smart Verify CBE account) and the prices. 501 ' +
          'PAYMENT_NOT_CONFIGURED when SUBSCRIPTION_CBE_ACCOUNT / _NAME are not set.',
        response: {
          200: z.object({
            bank: z.literal('CBE'),
            accountNumber: z.string(),
            accountName: z.string(),
            telebirr: z.object({ number: z.string(), name: z.string() }).nullable(),
            prices: z.object({
              normal: z.object({ monthly: z.number().int(), quarterly: z.number().int() }),
              normal_multi: z.object({ monthly: z.number().int() }),
              restaurant_normal: z.object({
                monthly: z.number().int(),
                quarterly: z.number().int(),
              }),
              restaurant: z.object({ monthly: z.number().int() }),
            }),
          }),
          ...errors,
          501: errorResponseSchema.describe('PAYMENT_NOT_CONFIGURED'),
        },
      },
    },
    async () => {
      if (!payTo) throw new AppError('PAYMENT_NOT_CONFIGURED');
      const settings = await getSettings(prisma);
      return {
        bank: 'CBE' as const,
        ...payTo,
        telebirr: payToTelebirr,
        prices: {
          normal: {
            monthly: settings.priceNormalMonthly,
            quarterly: settings.priceNormalQuarterly,
          },
          normal_multi: { monthly: settings.priceNormalMultiMonthly },
          restaurant_normal: {
            monthly: settings.priceRestaurantNormalMonthly,
            quarterly: settings.priceRestaurantNormalQuarterly,
          },
          restaurant: { monthly: settings.priceRestaurantMonthly },
        },
      };
    }
  );

  app.post(
    '/subscription/pay',
    {
      preHandler: requireRoles('owner'),
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        description:
          'Pays for a plan with a CBE transfer (url: the CBE receipt link) or a telebirr transfer ' +
          '(telebirrNumber) to Smart Verify. CBE url: the receipt link (from ' +
          'its QR, or built from the FT reference + sender account last 8). The receipt must ' +
          'show Smart Verify as receiver (account + name), at least the plan price, success and ' +
          'be recent; then the plan starts at once. One receipt pays once (RECEIPT_USED). ' +
          'Answers { check, subscription }: subscription is null when the check did not pass.',
        headers: z.object({
          'idempotency-key': z.string().min(8).max(100).describe('A new UUID per user action'),
        }),
        body: z.object({
          plan: planSchema,
          period: z.enum(['monthly', 'quarterly']),
          url: z.string().min(1).max(500).optional().describe('CBE receipt link'),
          telebirrNumber: z
            .string()
            .trim()
            .toUpperCase()
            .regex(TELEBIRR_NUMBER)
            .optional()
            .describe('Or: the telebirr transaction number of a payment to Smart Verify'),
          bank: z
            .enum(['DAS', 'BOA', 'MPE', 'EBR'])
            .optional()
            .describe('Or: the bank the owner paid from (Dashen, BOA, M-PESA, eBirr) …'),
          reference: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .optional()
            .describe('… with its receipt reference (as for /verify/<bank>)'),
        }),
        response: {
          200: z.object({
            check: verifyResponseSchema,
            subscription: subscriptionSchema.nullable(),
            review: z
              .enum(['pending'])
              .nullable()
              .describe('Sent to the Smart Verify team to decide'),
          }),
          ...errors,
          409: errorResponseSchema.describe('RECEIPT_USED'),
          501: errorResponseSchema.describe('PAYMENT_NOT_CONFIGURED'),
        },
      },
    },
    async (request) => {
      if (!payTo) throw new AppError('PAYMENT_NOT_CONFIGURED');
      const { businessId } = request.auth;
      const { plan, url, telebirrNumber, bank } = request.body;
      // Exactly one way: CBE link, telebirr number, or another bank + its reference.
      const other = bank ? OTHER_BANKS[bank as OtherBank] : null;
      const reference = other
        ? other.caseSensitive
          ? request.body.reference
          : request.body.reference?.toUpperCase()
        : undefined;
      if ([url, telebirrNumber, bank].filter(Boolean).length !== 1) {
        throw new AppError('VALIDATION_ERROR', { reason: 'oneWayToPay' });
      }
      if (other && !(reference && other.format.test(reference))) {
        throw new AppError('VALIDATION_ERROR', { reason: 'reference' });
      }
      if (telebirrNumber && !payToTelebirr) throw new AppError('PAYMENT_NOT_CONFIGURED');
      const period: BillingPeriod = hasQuarterly(plan) ? request.body.period : 'monthly';
      const pricing = planPricing(await getSettings(prisma), plan, period);
      if (!pricing) throw new AppError('VALIDATION_ERROR');
      const idempotencyKey = request.headers['idempotency-key'];

      // A retry of the same action returns what the first one did.
      const earlier = await prisma.subscription.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
      });
      if (earlier?.paymentReference) {
        return {
          check: {
            status: 'verified' as const,
            reference: earlier.paymentReference,
            amountEtb: earlier.priceEtb,
            extraEtb: 0,
            payerName: '',
            receiverName: payTo.accountName,
            date: earlier.startedAt.toISOString(),
          },
          subscription: toSubscription(earlier),
          review: null,
        };
      }

      // Our accounts a payment from another bank may arrive in (to the CBE account, or telebirr).
      const ourAccounts = [
        {
          bankCode: 'CBE',
          accountNumber: payTo.accountNumber,
          last4: payTo.accountNumber.slice(-4),
          holderName: payTo.accountName,
        },
        ...(payToTelebirr
          ? [
              {
                bankCode: 'TEL',
                accountNumber: payToTelebirr.number,
                last4: payToTelebirr.number.slice(-4),
                holderName: payToTelebirr.name,
              },
            ]
          : []),
      ];
      const check = other
        ? await other.verify(
            prisma,
            env,
            businessId,
            reference ?? '',
            pricing.priceEtb,
            request.log,
            new Date(),
            {
              accounts: ourAccounts,
              name: payTo.accountName,
              maxAgeHours: env.SUBSCRIPTION_RECEIPT_MAX_AGE_HOURS,
            }
          )
        : telebirrNumber && payToTelebirr
          ? await verifyTelebirr(
              prisma,
              env,
              businessId,
              telebirrNumber,
              pricing.priceEtb,
              request.log,
              new Date(),
              {
                accounts: [
                  {
                    bankCode: 'TEL',
                    accountNumber: payToTelebirr.number,
                    last4: payToTelebirr.number.slice(-4),
                    holderName: payToTelebirr.name,
                  },
                ],
                name: payToTelebirr.name,
                maxAgeHours: env.SUBSCRIPTION_RECEIPT_MAX_AGE_HOURS,
              }
            )
          : await verifyCbe(
              prisma,
              env,
              businessId,
              url ?? '',
              pricing.priceEtb,
              request.log,
              new Date(),
              {
                accounts: [
                  {
                    bankCode: 'CBE',
                    accountNumber: payTo.accountNumber,
                    last4: payTo.accountNumber.slice(-4),
                    holderName: payTo.accountName,
                  },
                ],
                name: payTo.accountName,
                maxAgeHours: env.SUBSCRIPTION_RECEIPT_MAX_AGE_HOURS,
              }
            );
      if (check.status !== 'verified') {
        // Not clearly wrong (amount a little low, bank site down, old receipt…): the admin decides.
        const reviewable =
          check.status === 'not_matching'
            ? !check.reasons.some((r) => r === 'WRONG_RECEIVER' || r === 'NOT_SUCCESS')
            : check.status === 'unable_to_verify' && check.reason !== 'NOT_FOUND';
        if (!reviewable) return { check, subscription: null, review: null };
        const receiptKey = other ? `${bank}:${reference}` : (telebirrNumber ?? url ?? '');
        await prisma.paymentReview.upsert({
          where: { businessId_receiptKey: { businessId, receiptKey } },
          update: {},
          create: {
            businessId,
            plan,
            period,
            expectedEtb: pricing.priceEtb,
            bankCode: bank ?? (telebirrNumber ? 'TEL' : 'CBE'),
            receiptKey,
            reference: check.status === 'not_matching' ? check.reference : null,
            paidEtb: check.status === 'not_matching' ? check.amountEtb : null,
            reasons: check.status === 'not_matching' ? check.reasons : [check.reason],
          },
        });
        return { check, subscription: null, review: 'pending' as const };
      }

      const used = await prisma.subscription.findUnique({
        where: { paymentReference: check.reference },
      });
      if (used) throw new AppError('RECEIPT_USED');

      try {
        const subscription = await prisma.$transaction((tx) =>
          startPaidPeriod(tx, {
            businessId,
            plan,
            period,
            priceEtb: pricing.priceEtb,
            months: pricing.months,
            paymentMethod: other ? other.method : telebirrNumber ? 'telebirr' : 'cbe',
            paymentReference: check.reference,
            idempotencyKey,
          })
        );
        request.log.info(
          { subscriptionPaid: check.reference, plan, period },
          `Subscription paid with CBE ${check.reference}: ${plan} ${period}`
        );
        forgetAccess(businessId);
        return { check, subscription: toSubscription(subscription), review: null };
      } catch (error) {
        // The same receipt used at the same moment by another request.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError('RECEIPT_USED');
        }
        throw error;
      }
    }
  );
};
