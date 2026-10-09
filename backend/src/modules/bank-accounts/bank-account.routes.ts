import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { BankAccount } from '../../generated/prisma/client.js';
import { requireRoles } from '../../plugins/auth.js';
import { findBank, SUPPORTED_BANKS } from '../../providers/banks.js';
import { AppError } from '../../shared/errors/app-error.js';
import { idParamSchema } from '../../shared/schemas/common.js';
import { isUniqueViolation } from '../auth/auth.service.js';

export const MAX_BANK_ACCOUNTS = 6;

const bankSchema = z.object({ code: z.string(), name: z.string(), shortName: z.string() });

/** Same as the app's `BankAccount`. The full account number is never returned. */
export const bankAccountSchema = z.object({
  id: z.string(),
  bankCode: z.string(),
  bankName: z.string(),
  shortName: z.string(),
  last4: z.string(),
  holderName: z.string().nullable(),
});

export const toBankAccount = (a: BankAccount) => {
  const bank = findBank(a.bankCode);
  return {
    id: a.id,
    bankCode: a.bankCode,
    bankName: bank?.name ?? a.bankCode,
    shortName: bank?.shortName ?? a.bankCode,
    last4: a.last4,
    holderName: a.holderName,
  };
};

export const bankAccountRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const canManage = requireRoles('owner', 'manager');

  app.get(
    '/banks',
    {
      schema: {
        tags: ['bank accounts'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(bankSchema) },
      },
    },
    async () => SUPPORTED_BANKS
  );

  app.get(
    '/bank-accounts',
    {
      schema: {
        tags: ['bank accounts'],
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(bankAccountSchema) },
      },
    },
    async (request) => {
      const accounts = await prisma.bankAccount.findMany({
        where: { businessId: request.auth.businessId, removedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return accounts.map(toBankAccount);
    }
  );

  app.post(
    '/bank-accounts',
    {
      preHandler: canManage,
      schema: {
        tags: ['bank accounts'],
        security: [{ bearerAuth: [] }],
        body: z.object({
          bankCode: z.string().refine((c) => Boolean(findBank(c))),
          accountNumber: z.string().regex(/^\d{10,13}$/),
          holderName: z.string().trim().max(80).optional(),
        }),
        response: { 201: bankAccountSchema },
      },
    },
    async (request, reply) => {
      const { businessId } = request.auth;
      const { bankCode, accountNumber, holderName } = request.body;
      try {
        const account = await prisma.$transaction(async (tx) => {
          // Lock the business row so two staff cannot both add the 6th account at once.
          await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
          const active = await tx.bankAccount.findMany({ where: { businessId, removedAt: null } });
          if (active.some((a) => a.bankCode === bankCode && a.accountNumber === accountNumber)) {
            throw new AppError('ACCOUNT_DUPLICATE');
          }
          if (active.length >= MAX_BANK_ACCOUNTS) throw new AppError('ACCOUNT_LIMIT');
          return tx.bankAccount.create({
            data: {
              businessId,
              bankCode,
              accountNumber,
              last4: accountNumber.slice(-4),
              // TODO: look the holder name up at the bank once a provider is integrated.
              holderName: holderName || null,
            },
          });
        });
        return reply.status(201).send(toBankAccount(account));
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError('ACCOUNT_DUPLICATE');
        throw error;
      }
    }
  );

  /** Soft delete: past transactions keep pointing at the account. */
  app.delete(
    '/bank-accounts/:id',
    {
      preHandler: canManage,
      schema: {
        tags: ['bank accounts'],
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const { count } = await prisma.bankAccount.updateMany({
        where: { id: request.params.id, businessId: request.auth.businessId, removedAt: null },
        data: { removedAt: new Date() },
      });
      if (count === 0) throw new AppError('NOT_FOUND');
      return reply.status(204).send(null);
    }
  );
};
