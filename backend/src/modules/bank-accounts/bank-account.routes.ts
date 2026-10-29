import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma } from '../../generated/prisma/client.js';
import { requireRoles } from '../../plugins/auth.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  customerPhoneSchema,
  errorResponseSchema,
  idParamSchema,
} from '../../shared/schemas/common.js';

/** Most receiving accounts a business can connect at once. */
export const MAX_BANK_ACCOUNTS = 6;
/** Telebirr has no account number: the wallet is the phone number (09… or 07…). */
const TELEBIRR = 'TEL';

const bankSchema = z.object({ code: z.string(), name: z.string(), shortName: z.string() });

const accountSchema = z.object({
  id: z.string(),
  bankCode: z.string(),
  bankName: z.string(),
  shortName: z.string(),
  last4: z.string().describe('The app only ever shows the last 4 digits'),
  holderName: z.string(),
});

const select = {
  id: true,
  bankCode: true,
  last4: true,
  holderName: true,
  bank: { select: { name: true, shortName: true } },
  business: { select: { name: true } },
} as const;

type Row = Prisma.BankAccountGetPayload<{ select: typeof select }>;

const toAccount = (row: Row) => ({
  id: row.id,
  bankCode: row.bankCode,
  bankName: row.bank.name,
  shortName: row.bank.shortName,
  last4: row.last4,
  // Until the bank can tell us the holder's name, an empty name shows the business name.
  holderName: row.holderName ?? row.business.name,
});

const errors = {
  401: errorResponseSchema.describe('UNAUTHORIZED'),
  403: errorResponseSchema.describe('FORBIDDEN'),
};

/** Receiving bank accounts (both plans). The full account number is never returned. */
export const bankAccountRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma } = app;
  const security = [{ bearerAuth: [] }];

  app.get(
    '/banks',
    {
      schema: {
        tags: ['bank accounts'],
        security,
        description: 'Supported banks and wallets (CBE, Telebirr, …).',
        response: { 200: z.array(bankSchema), ...errors },
      },
    },
    async () =>
      prisma.bank.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true, shortName: true },
      })
  );

  app.get(
    '/bank-accounts',
    {
      preHandler: requireRoles('owner', 'manager', 'waiter'),
      schema: {
        tags: ['bank accounts'],
        security,
        description: 'Connected receiving accounts, oldest first.',
        response: { 200: z.array(accountSchema), ...errors },
      },
    },
    async (request) => {
      const rows = await prisma.bankAccount.findMany({
        where: { businessId: request.auth.businessId, removedAt: null },
        orderBy: { createdAt: 'asc' },
        select,
      });
      return rows.map(toAccount);
    }
  );

  app.post(
    '/bank-accounts',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['bank accounts'],
        security,
        description:
          `Connect a receiving account (max ${MAX_BANK_ACCOUNTS}). The same bank and number ` +
          'twice gives ACCOUNT_DUPLICATE; a full list gives ACCOUNT_LIMIT. Without holderName ' +
          'the business name is shown until the bank can tell us the real name (CBE, Telebirr, Dashen ' +
          'and BOA accounts must have holderName: payment checks compare it with the receipt). Telebirr takes the ' +
          'wallet phone number (10 digits, 09… or 07…) as accountNumber.',
        body: z.object({
          bankCode: z.string().min(1).max(10),
          // Lengths differ by bank (Abyssinia 8–9, CBE 13, some 16).
          accountNumber: z.string().regex(/^\d{8,16}$/, '8–16 digits'),
          holderName: z.string().trim().min(1).max(80).optional(),
        }),
        response: {
          201: accountSchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR (bad number or unknown bank)'),
          ...errors,
          409: errorResponseSchema.describe('ACCOUNT_DUPLICATE | ACCOUNT_LIMIT'),
        },
      },
    },
    async (request, reply) => {
      const { businessId } = request.auth;
      const { bankCode, accountNumber, holderName } = request.body;
      const bank = await prisma.bank.findFirst({ where: { code: bankCode, active: true } });
      if (!bank) throw new AppError('VALIDATION_ERROR', { reason: 'unknownBank' });
      // CBE and telebirr receipts show the receiver's name; the check compares it with this.
      if (['CBE', TELEBIRR, 'DAS', 'BOA'].includes(bankCode) && !holderName) {
        throw new AppError('VALIDATION_ERROR', { reason: 'holderNameRequired' });
      }
      if (bankCode === TELEBIRR && !customerPhoneSchema.safeParse(accountNumber).success) {
        throw new AppError('VALIDATION_ERROR', { reason: 'telebirrPhone' });
      }

      try {
        const row = await prisma.$transaction(async (tx) => {
          const active = await tx.bankAccount.findMany({
            where: { businessId, removedAt: null },
            select: { bankCode: true, accountNumber: true },
          });
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
              holderName: holderName ?? null,
            },
            select,
          });
        });
        return reply.status(201).send(toAccount(row));
      } catch (error) {
        // The same account added twice at the same moment (partial unique index).
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError('ACCOUNT_DUPLICATE');
        }
        throw error;
      }
    }
  );

  app.patch(
    '/bank-accounts/:id',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['bank accounts'],
        security,
        description:
          'Change the holder name and/or the number of a connected account (the bank stays). ' +
          'The new number follows the same rules as when adding; a number already connected ' +
          'gives ACCOUNT_DUPLICATE.',
        params: idParamSchema,
        body: z.object({
          accountNumber: z
            .string()
            .regex(/^\d{8,16}$/, '8–16 digits')
            .optional(),
          holderName: z.string().trim().min(1).max(80).optional(),
        }),
        response: {
          200: accountSchema,
          400: errorResponseSchema.describe('VALIDATION_ERROR'),
          ...errors,
          404: errorResponseSchema.describe('NOT_FOUND'),
          409: errorResponseSchema.describe('ACCOUNT_DUPLICATE'),
        },
      },
    },
    async (request) => {
      const { businessId } = request.auth;
      const { accountNumber, holderName } = request.body;
      const current = await prisma.bankAccount.findFirst({
        where: { id: request.params.id, businessId, removedAt: null },
        select: { bankCode: true },
      });
      if (!current) throw new AppError('NOT_FOUND');
      const { bankCode } = current;
      if (
        accountNumber &&
        bankCode === TELEBIRR &&
        !customerPhoneSchema.safeParse(accountNumber).success
      ) {
        throw new AppError('VALIDATION_ERROR', { reason: 'telebirrPhone' });
      }
      if (accountNumber) {
        const taken = await prisma.bankAccount.findFirst({
          where: {
            businessId,
            bankCode,
            accountNumber,
            removedAt: null,
            NOT: { id: request.params.id },
          },
          select: { id: true },
        });
        if (taken) throw new AppError('ACCOUNT_DUPLICATE');
      }
      try {
        const row = await prisma.bankAccount.update({
          where: { id: request.params.id },
          data: {
            ...(accountNumber && { accountNumber, last4: accountNumber.slice(-4) }),
            ...(holderName && { holderName }),
          },
          select,
        });
        return toAccount(row);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError('ACCOUNT_DUPLICATE');
        }
        throw error;
      }
    }
  );

  app.delete(
    '/bank-accounts/:id',
    {
      preHandler: requireRoles('owner', 'manager'),
      schema: {
        tags: ['bank accounts'],
        security,
        description:
          'Removes the account from the list. Past records keep it; it can be added again later.',
        params: idParamSchema,
        response: { 204: z.null(), ...errors, 404: errorResponseSchema.describe('NOT_FOUND') },
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
