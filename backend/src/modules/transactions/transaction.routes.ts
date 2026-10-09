import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Transaction } from '../../generated/prisma/client.js';
import { requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import { idParamSchema, periodSchema } from '../../shared/schemas/common.js';
import { periodRange } from '../../shared/utils/business-day.js';
import { bankAccountSchema, toBankAccount } from '../bank-accounts/bank-account.routes.js';

const statusSchema = z.enum(['verified', 'pending', 'mismatch', 'duplicate']);

/** Same as the app's `Transaction` type. */
const transactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  payerName: z.string(),
  reference: z.string(),
  expectedAmount: z.number().int(),
  receivedAmount: z.number().int(),
  status: statusSchema,
  createdAt: z.string(),
});

const toTransaction = (t: Transaction) => ({
  id: t.id,
  accountId: t.bankAccountId,
  payerName: t.payerName,
  reference: t.reference,
  expectedAmount: t.expectedAmount,
  receivedAmount: t.receivedAmount,
  status: t.status,
  createdAt: t.createdAt.toISOString(),
});

export const transactionRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma, env } = app;
  const notChef = requireRoles('owner', 'manager', 'waiter');
  const tz = env.BUSINESS_TIMEZONE;

  app.get(
    '/transactions',
    {
      preHandler: notChef,
      schema: {
        tags: ['transactions'],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          period: periodSchema,
          accountId: z.string().optional(),
          status: statusSchema.optional(),
        }),
        response: { 200: z.array(transactionSchema) },
      },
    },
    async (request) => {
      const { period, accountId, status } = request.query;
      const { from, to } = periodRange(period, tz);
      const rows = await prisma.transaction.findMany({
        where: {
          businessId: request.auth.businessId,
          createdAt: { gte: from, lte: to },
          ...(accountId && { bankAccountId: accountId }),
          ...(status && { status }),
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
      return rows.map(toTransaction);
    }
  );

  app.get(
    '/transactions/:id',
    {
      preHandler: notChef,
      schema: {
        tags: ['transactions'],
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: { 200: transactionSchema },
      },
    },
    async (request) => {
      const tx = await prisma.transaction.findFirst({
        where: { id: request.params.id, businessId: request.auth.businessId },
      });
      if (!tx) throw new AppError('NOT_FOUND');
      return toTransaction(tx);
    }
  );

  /** Home "Today" card. */
  app.get(
    '/summary/today',
    {
      preHandler: notChef,
      schema: {
        tags: ['transactions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            verified: z.number().int(),
            pending: z.number().int(),
            duplicate: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const { from, to } = periodRange('today', tz);
      const groups = await prisma.transaction.groupBy({
        by: ['status'],
        where: { businessId: request.auth.businessId, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      });
      const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
      return {
        verified: count('verified'),
        pending: count('pending'),
        duplicate: count('duplicate'),
      };
    }
  );

  /** Report by bank: only verified money counts. Removed accounts still show if they received money. */
  app.get(
    '/reports/by-bank',
    {
      preHandler: async (request) => {
        const { role, canSeeReports } = request.auth;
        if (!(role === 'owner' || role === 'manager' || canSeeReports))
          throw new AppError('FORBIDDEN');
      },
      schema: {
        tags: ['reports'],
        security: [{ bearerAuth: [] }],
        querystring: z.object({ period: periodSchema }),
        response: {
          200: z.object({
            total: z.number().int(),
            count: z.number().int(),
            rows: z.array(
              z.object({
                account: bankAccountSchema,
                count: z.number().int(),
                total: z.number().int(),
                share: z.number().int(),
              })
            ),
          }),
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { from, to } = periodRange(request.query.period, tz);
      const sums = await prisma.transaction.groupBy({
        by: ['bankAccountId'],
        where: { businessId, status: 'verified', createdAt: { gte: from, lte: to } },
        _sum: { receivedAmount: true },
        _count: { _all: true },
      });
      const accounts = await prisma.bankAccount.findMany({
        where: {
          businessId,
          OR: [{ removedAt: null }, { id: { in: sums.map((s) => s.bankAccountId) } }],
        },
      });
      const total = sums.reduce((acc, s) => acc + (s._sum.receivedAmount ?? 0), 0);
      const rows = accounts
        .map((account) => {
          const s = sums.find((x) => x.bankAccountId === account.id);
          const accountTotal = s?._sum.receivedAmount ?? 0;
          return {
            account: toBankAccount(account),
            count: s?._count._all ?? 0,
            total: accountTotal,
            share: total ? Math.round((accountTotal / total) * 100) : 0,
          };
        })
        .sort((a, b) => b.total - a.total);
      return { total, count: sums.reduce((acc, s) => acc + s._count._all, 0), rows };
    }
  );
};
