import { freemem, totalmem } from 'node:os';

import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma } from '../../generated/prisma/client.js';
import {
  forgetAccess,
  latestSubscription,
  startPaidPeriod,
} from '../../services/business-access.js';
import { checkBankSites, responseTimes } from '../../services/health.js';
import { sendTelegram } from '../../services/issues.js';
import { accessOf, RESTRICTED_BLOCKS } from '../../services/lifecycle.js';
import { forgetSettings, getSettings, planPricing } from '../../services/platform-settings.js';
import { AppError } from '../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../shared/schemas/common.js';

import { createAdminAuth, recordActivity } from './admin-auth.js';
import {
  csvCell,
  formatPhone,
  loadCustomers,
  startOfAddisDay,
  startOfMonth,
  type CustomerRow,
} from './admin-data.js';

const DAY_MS = 24 * 60 * 60_000;
/** Tells Excel the CSV is UTF-8 (Amharic names). */
const EXCEL_BOM = String.fromCharCode(0xfeff);
const STATUSES = ['trial', 'active', 'grace', 'restricted', 'suspended'] as const;
const planSchema = z.enum(['normal', 'normal_multi', 'restaurant_normal', 'restaurant']);
const periodSchema = z.enum(['monthly', 'quarterly']);
const idParams = z.object({ id: z.string().min(1).max(40) });
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

const customerSummary = z.object({
  id: z.string(),
  name: z.string(),
  businessType: z.string().nullable(),
  city: z.string().nullable(),
  plan: planSchema.nullable(),
  ownerName: z.string(),
  ownerPhone: z.string(),
  status: z.enum(STATUSES),
  endsAt: z.string().nullable(),
  daysLeft: z.number().int().nullable(),
  exempt: z.boolean(),
  priceEtb: z.number().int().nullable(),
  period: z.string().nullable(),
});
const summaryOf = (c: CustomerRow) => ({
  id: c.id,
  name: c.name,
  businessType: c.businessType,
  city: c.city,
  plan: c.plan,
  ownerName: c.ownerName,
  ownerPhone: formatPhone(c.ownerPhone),
  status: c.access.status,
  endsAt: iso(c.access.endsAt),
  daysLeft: c.access.daysLeft,
  exempt: c.access.exempt,
  priceEtb: c.latest?.priceEtb ?? null,
  period: c.latest?.period ?? null,
});

/** Overdue: past the end, still counted until it pays (grace, restricted, suspended by rules). */
const isOverdue = (c: CustomerRow) =>
  c.access.status === 'grace' ||
  c.access.status === 'restricted' ||
  (c.access.status === 'suspended' && !c.access.suspendedByAdmin);

/**
 * Everything the Smart Verify team runs the business with: customers, money, rules, health,
 * messages. Every change (and every view of private data) goes to the activity log.
 */
export const adminConsoleRoutes: FastifyPluginAsyncZod = async (app) => {
  const { prisma, env } = app;
  const auth = createAdminAuth(app);
  app.addHook('onRequest', (request) => auth.authenticate(request, 'full'));
  const tags = ['admin'];
  const security = [{ bearerAuth: [] }];
  const log = (
    request: FastifyRequest,
    entry: Omit<Parameters<typeof recordActivity>[2], 'adminId'>
  ) => {
    // Any admin change to a customer applies to their app on the next request.
    if (entry.businessId) forgetAccess(entry.businessId);
    return recordActivity(prisma, request, { adminId: request.admin.admin.id, ...entry });
  };
  const businessExists = async (id: string) => {
    const b = await prisma.business.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!b) throw new AppError('NOT_FOUND');
    return b;
  };

  // ─── Home ───────────────────────────────────────────────────────────────
  app.get(
    '/admin/dashboard',
    {
      schema: {
        tags,
        security,
        description: 'The numbers on the admin home page.',
        response: { 200: z.any(), 401: errorResponseSchema },
      },
    },
    async () => {
      const now = new Date();
      const settings = await getSettings(prisma);
      const customers = await loadCustomers(prisma, settings, now);
      const today = startOfAddisDay(now);
      const paid = { paymentMethod: { in: ['cbe', 'telebirr', 'manual'] } };
      const [months, reviews, oldReviews, errors, topError, verified, bankPaid, failed, gemini] =
        await Promise.all([
          Promise.all(
            [5, 4, 3, 2, 1, 0].map(async (back) => {
              const from = startOfMonth(now, back);
              const to = startOfMonth(now, back - 1);
              const sum = await prisma.subscription.aggregate({
                where: { ...paid, createdAt: { gte: from, lt: to } },
                _sum: { priceEtb: true },
              });
              return { month: from.toISOString().slice(0, 7), etb: sum._sum.priceEtb ?? 0 };
            })
          ),
          prisma.paymentReview.count({ where: { status: 'pending' } }),
          prisma.paymentReview.count({
            where: { status: 'pending', createdAt: { lt: new Date(now.getTime() - DAY_MS) } },
          }),
          prisma.errorLog.count({ where: { resolvedAt: null } }),
          prisma.errorLog.findFirst({ where: { resolvedAt: null }, orderBy: { lastSeen: 'desc' } }),
          prisma.transaction.count({ where: { status: 'verified', createdAt: { gte: today } } }),
          prisma.payment.count({ where: { method: { not: 'cash' }, createdAt: { gte: today } } }),
          prisma.receiptCheck.groupBy({
            by: ['status'],
            where: { createdAt: { gte: today } },
            _count: true,
          }),
          prisma.dailyCounter.findMany({ where: { day: now.toISOString().slice(0, 10) } }),
        ]);
      const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
        (typeof STATUSES)[number],
        number
      >;
      for (const c of customers) counts[c.access.status] += 1;
      const in7 = new Date(now.getTime() + 7 * DAY_MS);
      const in30 = new Date(now.getTime() + 30 * DAY_MS);
      const overdue = customers.filter(isOverdue);
      const counter = (key: string) => gemini.find((g) => g.key === key)?.count ?? 0;
      return {
        needs: {
          reviews,
          reviewsOlderThanDay: oldReviews,
          overdue: overdue.length,
          restrictedThisWeek: overdue.filter(
            (c) => c.access.status === 'grace' && c.access.nextStepAt && c.access.nextStepAt < in7
          ).length,
          errors,
          topError: topError?.cause ?? null,
        },
        money: {
          thisMonth: months[5]?.etb ?? 0,
          lastMonth: months[4]?.etb ?? 0,
          expected30: customers
            .filter(
              (c) => c.latest && c.access.endsAt && c.access.endsAt > now && c.access.endsAt < in30
            )
            .reduce((sum, c) => sum + (c.latest?.priceEtb ?? 0), 0),
          months,
        },
        customers: { total: customers.length, ...counts },
        dueSoon: customers
          .filter(
            (c) =>
              (c.access.status === 'active' || c.access.status === 'trial') &&
              c.access.endsAt &&
              c.access.endsAt < in7
          )
          .sort((a, b) => (a.access.endsAt?.getTime() ?? 0) - (b.access.endsAt?.getTime() ?? 0))
          .slice(0, 8)
          .map(summaryOf),
        checksToday: {
          verified: verified + bankPaid,
          notMatching: failed.find((f) => f.status === 'not_matching')?._count ?? 0,
          unable: failed.find((f) => f.status === 'unable_to_verify')?._count ?? 0,
        },
        banks: await checkBankSites(),
        gemini: { calls: counter('gemini_calls'), rateLimited: counter('gemini_rate_limited') },
      };
    }
  );

  // ─── Customers ──────────────────────────────────────────────────────────
  const listQuery = z.object({
    search: z.string().trim().max(80).optional(),
    plan: planSchema.optional(),
    city: z.string().trim().max(60).optional(),
    filter: z.enum(['all', 'overdue', 'trial', 'restricted', 'new']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
  });
  const filterCustomers = (rows: CustomerRow[], q: z.infer<typeof listQuery>, now: Date) => {
    const search = q.search?.toLowerCase().replace(/\s/g, '');
    const monthStart = startOfMonth(now);
    return rows.filter((c) => {
      if (q.plan && c.plan !== q.plan) return false;
      if (q.city && (c.city ?? '').toLowerCase() !== q.city.toLowerCase()) return false;
      if (q.filter === 'overdue' && !isOverdue(c)) return false;
      if (q.filter === 'trial' && c.access.status !== 'trial') return false;
      if (
        q.filter === 'restricted' &&
        c.access.status !== 'restricted' &&
        c.access.status !== 'suspended'
      )
        return false;
      if (q.filter === 'new' && c.createdAt < monthStart) return false;
      if (search) {
        const hay = `${c.name} ${c.ownerName} ${c.ownerPhone} ${c.city ?? ''}`
          .toLowerCase()
          .replace(/\s/g, '');
        if (!hay.includes(search.replace(/^\+?251/, ''))) return false;
      }
      return true;
    });
  };

  app.get(
    '/admin/customers',
    {
      schema: {
        tags,
        security,
        querystring: listQuery,
        response: {
          200: z.object({
            items: z.array(customerSummary),
            total: z.number().int(),
            all: z.number().int(),
            tabs: z.object({
              overdue: z.number().int(),
              trial: z.number().int(),
              restricted: z.number().int(),
              new: z.number().int(),
            }),
            cities: z.array(z.string()),
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const now = new Date();
      const rows = await loadCustomers(prisma, await getSettings(prisma), now);
      const filtered = filterCustomers(rows, request.query, now);
      const PAGE = 25;
      const count = (filter: 'overdue' | 'trial' | 'restricted' | 'new') =>
        filterCustomers(rows, { ...request.query, filter, search: undefined, page: 1 }, now).length;
      return {
        items: filtered
          .slice((request.query.page - 1) * PAGE, request.query.page * PAGE)
          .map(summaryOf),
        total: filtered.length,
        all: rows.length,
        tabs: {
          overdue: count('overdue'),
          trial: count('trial'),
          restricted: count('restricted'),
          new: count('new'),
        },
        cities: [...new Set(rows.flatMap((r) => (r.city ? [r.city] : [])))].sort(),
      };
    }
  );

  app.get(
    '/admin/customers.csv',
    {
      schema: { tags, security, querystring: listQuery, description: 'The filtered list as CSV.' },
    },
    async (request, reply) => {
      const now = new Date();
      const rows = filterCustomers(
        await loadCustomers(prisma, await getSettings(prisma), now),
        request.query,
        now
      );
      await log(request, {
        category: 'private_data',
        action: 'exported_customers',
        details: { rows: rows.length },
      });
      const header = [
        'Business',
        'Type',
        'City',
        'Owner',
        'Phone',
        'Plan',
        'Status',
        'Ends',
        'Price ETB',
      ];
      const lines = rows.map((c) =>
        [
          c.name,
          c.businessType,
          c.city,
          c.ownerName,
          formatPhone(c.ownerPhone),
          c.plan,
          c.access.status,
          iso(c.access.endsAt)?.slice(0, 10),
          c.latest?.priceEtb,
        ]
          .map(csvCell)
          .join(',')
      );
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="customers.csv"')
        .send(`${EXCEL_BOM}${[header.map(csvCell).join(','), ...lines].join('\r\n')}`);
    }
  );

  app.get(
    '/admin/customers/:id',
    {
      schema: {
        tags,
        security,
        description:
          'One customer: profile, people and phones, location, plan, payments, usage, notes. ' +
          'Each view is saved in the activity log (private data).',
        params: idParams,
        response: { 200: z.any(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const { id } = request.params;
      const now = new Date();
      const settings = await getSettings(prisma);
      const business = await prisma.business.findUnique({
        where: { id },
        include: {
          members: {
            where: { active: true },
            include: {
              user: { select: { name: true, phone: true } },
              sessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            },
          },
          bankAccounts: { where: { removedAt: null }, select: { bankCode: true, last4: true } },
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 24 },
          adminNotes: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { admin: { select: { name: true } } },
          },
          paymentReviews: { where: { status: 'pending' }, orderBy: { createdAt: 'desc' } },
        },
      });
      if (!business) throw new AppError('NOT_FOUND');
      const latest = await latestSubscription(prisma, id);
      const access = accessOf({ ...business, latest }, settings, now);
      const monthStart = startOfMonth(now);
      const [checksVerified, checksFailed, payments, devices] = await Promise.all([
        prisma.transaction.count({
          where: { businessId: id, status: 'verified', createdAt: { gte: monthStart } },
        }),
        prisma.receiptCheck.count({ where: { businessId: id, createdAt: { gte: monthStart } } }),
        prisma.payment.count({
          where: { businessId: id, method: { not: 'cash' }, createdAt: { gte: monthStart } },
        }),
        prisma.session.count({
          where: { member: { businessId: id }, revokedAt: null, expiresAt: { gt: now } },
        }),
      ]);
      await log(request, { category: 'private_data', action: 'viewed_customer', businessId: id });

      const end = access.endsAt;
      const graceEnd = end ? new Date(end.getTime() + settings.graceDays * DAY_MS) : null;
      const restrictedEnd = graceEnd
        ? new Date(graceEnd.getTime() + settings.restrictedDays * DAY_MS)
        : null;
      return {
        id: business.id,
        name: business.name,
        businessType: business.businessType,
        city: business.city,
        address: business.address,
        latitude: business.latitude,
        longitude: business.longitude,
        createdAt: iso(business.createdAt),
        plan: business.plan,
        suspendedAt: iso(business.suspendedAt),
        exempt: business.exemptFromRules,
        exemptReason: business.exemptReason,
        access: {
          status: access.status,
          endsAt: iso(access.endsAt),
          daysLeft: access.daysLeft,
          nextStepAt: iso(access.nextStepAt),
          suspendedByAdmin: access.suspendedByAdmin,
          steps: {
            endsAt: iso(end),
            graceEndsAt: iso(graceEnd),
            restrictedEndsAt: iso(restrictedEnd),
          },
        },
        current: latest
          ? {
              plan: latest.plan,
              period: latest.period,
              priceEtb: latest.priceEtb,
              startedAt: iso(latest.startedAt),
              endsAt: iso(latest.endsAt),
            }
          : null,
        prices: {
          normalMonthly: settings.priceNormalMonthly,
          normalQuarterly: settings.priceNormalQuarterly,
          normalMultiMonthly: settings.priceNormalMultiMonthly,
          restaurantNormalMonthly: settings.priceRestaurantNormalMonthly,
          restaurantNormalQuarterly: settings.priceRestaurantNormalQuarterly,
          restaurantMonthly: settings.priceRestaurantMonthly,
        },
        payments: business.subscriptions.map((s) => ({
          id: s.id,
          plan: s.plan,
          period: s.period,
          priceEtb: s.priceEtb,
          startedAt: iso(s.startedAt),
          endsAt: iso(s.endsAt),
          paymentMethod: s.paymentMethod,
          reference: s.paymentReference,
          note: s.note,
          createdAt: iso(s.createdAt),
          cancelled: s.status === 'cancelled',
        })),
        pendingReviews: business.paymentReviews.map((r) => ({
          id: r.id,
          expectedEtb: r.expectedEtb,
          bankCode: r.bankCode,
          createdAt: iso(r.createdAt),
        })),
        people: business.members
          .sort(
            (a, b) =>
              ['owner', 'manager', 'waiter', 'chef'].indexOf(a.role) -
              ['owner', 'manager', 'waiter', 'chef'].indexOf(b.role)
          )
          .map((m) => ({
            name: m.user.name,
            role: m.role,
            phone: m.role === 'owner' || m.role === 'manager' ? formatPhone(m.user.phone) : null,
            lastSignInAt: iso(m.sessions[0]?.createdAt),
          })),
        usage: {
          receiptChecks: checksVerified + checksFailed + payments,
          verified: checksVerified + payments,
          activeDevices: devices,
        },
        banks: [...new Set(business.bankAccounts.map((a) => a.bankCode))],
        notes: business.adminNotes.map((n) => ({
          id: n.id,
          text: n.text,
          adminName: n.admin.name,
          createdAt: iso(n.createdAt),
        })),
      };
    }
  );

  const noteBody = z.object({ note: z.string().trim().max(500).optional() });

  app.post(
    '/admin/customers/:id/extend',
    {
      schema: {
        tags,
        security,
        description: 'Adds days to the current period (or from today when it already ended).',
        params: idParams,
        body: noteBody.extend({ days: z.number().int().min(1).max(366) }),
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const business = await businessExists(id);
      const now = new Date();
      const latest = await latestSubscription(prisma, id);
      const from = latest && latest.endsAt > now ? latest.endsAt : now;
      const to = new Date(from.getTime() + request.body.days * DAY_MS);
      if (latest && latest.endsAt > now) {
        await prisma.subscription.update({ where: { id: latest.id }, data: { endsAt: to } });
      } else {
        const full = await prisma.business.findUniqueOrThrow({
          where: { id },
          select: { plan: true },
        });
        await prisma.subscription.create({
          data: {
            businessId: id,
            plan: latest?.plan ?? full.plan ?? 'normal',
            period: latest?.period ?? 'monthly',
            priceEtb: 0,
            startedAt: now,
            endsAt: to,
            paymentMethod: 'manual',
            note: request.body.note ?? `Extended ${request.body.days} days`,
          },
        });
      }
      await log(request, {
        category: 'money',
        action: 'extended_subscription',
        businessId: business.id,
        details: {
          days: request.body.days,
          from: iso(from),
          to: iso(to),
          note: request.body.note ?? null,
        },
      });
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/admin/customers/:id/mark-paid',
    {
      schema: {
        tags,
        security,
        description: 'Starts a paid period by hand (paid outside the app), at the current price.',
        params: idParams,
        body: noteBody.extend({ plan: planSchema, period: periodSchema }),
        response: {
          204: z.null(),
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const business = await businessExists(request.params.id);
      const { plan } = request.body;
      const period =
        plan === 'normal' || plan === 'restaurant_normal' ? request.body.period : 'monthly';
      const pricing = planPricing(await getSettings(prisma), plan, period);
      if (!pricing) throw new AppError('VALIDATION_ERROR');
      const sub = await prisma.$transaction((tx) =>
        startPaidPeriod(tx, {
          businessId: business.id,
          plan,
          period,
          priceEtb: pricing.priceEtb,
          months: pricing.months,
          paymentMethod: 'manual',
          note: request.body.note ?? null,
        })
      );
      await log(request, {
        category: 'money',
        action: 'marked_paid',
        businessId: business.id,
        details: {
          plan,
          period,
          priceEtb: pricing.priceEtb,
          endsAt: iso(sub.endsAt),
          note: request.body.note ?? null,
        },
      });
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/admin/customers/:id/suspend',
    {
      schema: {
        tags,
        security,
        description: 'Suspend (only sign-in and the pay page work) or reactivate.',
        params: idParams,
        body: noteBody.extend({ suspended: z.boolean() }),
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const business = await businessExists(request.params.id);
      await prisma.business.update({
        where: { id: business.id },
        data: { suspendedAt: request.body.suspended ? new Date() : null },
      });
      await log(request, {
        category: 'customers',
        action: request.body.suspended ? 'suspended_customer' : 'reactivated_customer',
        businessId: business.id,
        details: { note: request.body.note ?? null },
      });
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/admin/customers/:id/plan',
    {
      schema: {
        tags,
        security,
        description: 'Changes the plan the business uses now (the price applies at renewal).',
        params: idParams,
        body: z.object({ plan: planSchema }),
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const business = await businessExists(request.params.id);
      const before = await prisma.business.findUniqueOrThrow({
        where: { id: business.id },
        select: { plan: true },
      });
      await prisma.business.update({
        where: { id: business.id },
        data: { plan: request.body.plan },
      });
      await log(request, {
        category: 'customers',
        action: 'changed_plan',
        businessId: business.id,
        details: { from: before.plan, to: request.body.plan },
      });
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/admin/customers/:id/exempt',
    {
      schema: {
        tags,
        security,
        description:
          'Never restrict this business for late payment (partner, special case), or undo.',
        params: idParams,
        body: z.object({ exempt: z.boolean(), reason: z.string().trim().max(200).optional() }),
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const business = await businessExists(request.params.id);
      await prisma.business.update({
        where: { id: business.id },
        data: {
          exemptFromRules: request.body.exempt,
          exemptReason: request.body.exempt ? (request.body.reason ?? null) : null,
        },
      });
      await log(request, {
        category: 'rules',
        action: request.body.exempt ? 'exempted_customer' : 'removed_exemption',
        businessId: business.id,
        details: { reason: request.body.reason ?? null },
      });
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/admin/customers/:id/notes',
    {
      schema: {
        tags,
        security,
        params: idParams,
        body: z.object({ text: z.string().trim().min(1).max(1000) }),
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const business = await businessExists(request.params.id);
      await prisma.adminNote.create({
        data: { businessId: business.id, adminId: request.admin.admin.id, text: request.body.text },
      });
      await log(request, { category: 'customers', action: 'added_note', businessId: business.id });
      return reply.status(204).send(null);
    }
  );

  // ─── Payments to review ────────────────────────────────────────────────
  app.get(
    '/admin/reviews',
    {
      schema: {
        tags,
        security,
        querystring: z.object({
          status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
        }),
        response: { 200: z.any(), 401: errorResponseSchema },
      },
    },
    async (request) => {
      const statuses =
        request.query.status === 'rejected'
          ? (['rejected', 'asked_rest'] as const)
          : [request.query.status];
      const [rows, pending] = await Promise.all([
        prisma.paymentReview.findMany({
          where: { status: { in: [...statuses] } },
          orderBy: { createdAt: request.query.status === 'pending' ? 'asc' : 'desc' },
          take: 100,
          include: {
            business: { select: { name: true } },
            decidedBy: { select: { name: true } },
          },
        }),
        prisma.paymentReview.count({ where: { status: 'pending' } }),
      ]);
      const references = rows.flatMap((r) => (r.reference ? [r.reference] : []));
      const used = new Set(
        (
          await prisma.subscription.findMany({
            where: { paymentReference: { in: references } },
            select: { paymentReference: true },
          })
        ).map((s) => s.paymentReference)
      );
      return {
        pending,
        items: rows.map((r) => ({
          id: r.id,
          businessId: r.businessId,
          businessName: r.business.name,
          plan: r.plan,
          period: r.period,
          expectedEtb: r.expectedEtb,
          bankCode: r.bankCode,
          receiptKey: r.receiptKey,
          reference: r.reference,
          paidEtb: r.paidEtb,
          reasons: r.reasons,
          status: r.status,
          note: r.note,
          decidedBy: r.decidedBy?.name ?? null,
          decidedAt: iso(r.decidedAt),
          createdAt: iso(r.createdAt),
          usedBefore: r.reference ? used.has(r.reference) : false,
        })),
      };
    }
  );

  app.post(
    '/admin/reviews/:id/decide',
    {
      schema: {
        tags,
        security,
        description:
          'approve: starts the plan now (clears the warning). reject. ask_rest: the customer ' +
          'must pay the rest first. The note goes to the activity log.',
        params: idParams,
        body: z.object({
          decision: z.enum(['approve', 'reject', 'ask_rest']),
          note: z.string().trim().max(500).optional(),
        }),
        response: {
          204: z.null(),
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const review = await prisma.paymentReview.findUnique({ where: { id: request.params.id } });
      if (!review) throw new AppError('NOT_FOUND');
      if (review.status !== 'pending') throw new AppError('CONFLICT');
      const { decision, note } = request.body;
      const adminId = request.admin.admin.id;
      if (decision === 'approve') {
        const pricing = planPricing(await getSettings(prisma), review.plan, review.period);
        if (!pricing) throw new AppError('VALIDATION_ERROR');
        try {
          await prisma.$transaction(async (tx) => {
            await startPaidPeriod(tx, {
              businessId: review.businessId,
              plan: review.plan,
              period: review.period,
              priceEtb: review.expectedEtb,
              months: pricing.months,
              paymentMethod: review.bankCode === 'TEL' ? 'telebirr' : 'cbe',
              paymentReference: review.reference,
              note: note ?? 'Approved by hand',
            });
            await tx.paymentReview.update({
              where: { id: review.id },
              data: {
                status: 'approved',
                note: note ?? null,
                decidedById: adminId,
                decidedAt: new Date(),
              },
            });
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new AppError('RECEIPT_USED');
          }
          throw error;
        }
      } else {
        await prisma.paymentReview.update({
          where: { id: review.id },
          data: {
            status: decision === 'reject' ? 'rejected' : 'asked_rest',
            note: note ?? null,
            decidedById: adminId,
            decidedAt: new Date(),
          },
        });
      }
      await log(request, {
        category: 'money',
        action:
          decision === 'approve'
            ? 'approved_payment'
            : decision === 'reject'
              ? 'rejected_payment'
              : 'asked_rest',
        businessId: review.businessId,
        details: {
          expectedEtb: review.expectedEtb,
          paidEtb: review.paidEtb,
          reference: review.reference,
          note: note ?? null,
        },
      });
      return reply.status(204).send(null);
    }
  );

  // ─── Rules and prices ──────────────────────────────────────────────────
  const settingsSchema = z.object({
    trialEnabled: z.boolean(),
    trialDays: z.number().int().min(1).max(90),
    reminderDays: z.array(z.number().int().min(1).max(30)).max(5),
    graceDays: z.number().int().min(0).max(30),
    restrictedDays: z.number().int().min(0).max(60),
    restrictedBlocks: z.array(z.enum(RESTRICTED_BLOCKS)),
    priceNormalMonthly: z.number().int().min(1).max(1_000_000),
    priceNormalQuarterly: z.number().int().min(1).max(1_000_000),
    priceNormalMultiMonthly: z.number().int().min(1).max(1_000_000),
    priceRestaurantNormalMonthly: z.number().int().min(1).max(1_000_000),
    priceRestaurantNormalQuarterly: z.number().int().min(1).max(1_000_000),
    priceRestaurantMonthly: z.number().int().min(1).max(1_000_000),
  });
  const settingsOut = (s: Awaited<ReturnType<typeof getSettings>>) => ({
    trialEnabled: s.trialEnabled,
    trialDays: s.trialDays,
    reminderDays: s.reminderDays,
    graceDays: s.graceDays,
    restrictedDays: s.restrictedDays,
    restrictedBlocks: s.restrictedBlocks.filter((b): b is (typeof RESTRICTED_BLOCKS)[number] =>
      (RESTRICTED_BLOCKS as readonly string[]).includes(b)
    ),
    priceNormalMonthly: s.priceNormalMonthly,
    priceNormalQuarterly: s.priceNormalQuarterly,
    priceNormalMultiMonthly: s.priceNormalMultiMonthly,
    priceRestaurantNormalMonthly: s.priceRestaurantNormalMonthly,
    priceRestaurantNormalQuarterly: s.priceRestaurantNormalQuarterly,
    priceRestaurantMonthly: s.priceRestaurantMonthly,
  });

  app.get(
    '/admin/settings',
    {
      schema: {
        tags,
        security,
        description: 'Rules, prices, exceptions, where customers pay, and alert status.',
        response: { 200: z.any(), 401: errorResponseSchema },
      },
    },
    async () => {
      const settings = await getSettings(prisma);
      const customers = await loadCustomers(prisma, settings);
      const exempt = await prisma.business.findMany({
        where: { exemptFromRules: true },
        select: { id: true, name: true, exemptReason: true },
      });
      const planCounts = { normal: 0, normal_multi: 0, restaurant_normal: 0, restaurant: 0 };
      for (const c of customers) if (c.plan) planCounts[c.plan] += 1;
      return {
        settings: settingsOut(settings),
        exceptions: exempt.map((b) => ({ businessId: b.id, name: b.name, reason: b.exemptReason })),
        impact: {
          overdue: customers.filter(isOverdue).length,
          restricted: customers.filter((c) => c.access.status === 'restricted').length,
        },
        planCounts,
        payTo: {
          cbe: env.SUBSCRIPTION_CBE_ACCOUNT
            ? {
                name: env.SUBSCRIPTION_CBE_NAME ?? '',
                last4: env.SUBSCRIPTION_CBE_ACCOUNT.slice(-4),
              }
            : null,
          telebirr: env.SUBSCRIPTION_TELEBIRR
            ? {
                name: env.SUBSCRIPTION_TELEBIRR_NAME ?? '',
                last4: env.SUBSCRIPTION_TELEBIRR.slice(-4),
              }
            : null,
        },
        telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      };
    }
  );

  app.put(
    '/admin/settings',
    {
      schema: {
        tags,
        security,
        description: "Saves rules and prices. New prices apply at each customer's next renewal.",
        body: settingsSchema,
        response: { 200: settingsSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const before = settingsOut(await getSettings(prisma));
      const body = {
        ...request.body,
        reminderDays: [...new Set(request.body.reminderDays)].sort((a, b) => b - a),
      };
      const saved = await prisma.platformSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...body },
        update: body,
      });
      forgetSettings();
      forgetAccess();
      const after = settingsOut(saved);
      const changes = Object.fromEntries(
        Object.entries(after).flatMap(([key, value]) =>
          JSON.stringify(value) === JSON.stringify(before[key as keyof typeof before])
            ? []
            : [[key, { from: before[key as keyof typeof before], to: value }]]
        )
      );
      if (Object.keys(changes).length > 0) {
        const money = Object.keys(changes).some((k) => k.startsWith('price'));
        await log(request, {
          category: money ? 'money' : 'rules',
          action: money ? 'changed_prices' : 'changed_rules',
          details: changes as Prisma.InputJsonValue,
        });
      }
      return after;
    }
  );

  // ─── Health and errors ─────────────────────────────────────────────────
  app.get(
    '/admin/health',
    {
      schema: {
        tags,
        security,
        querystring: z.object({ recheck: z.coerce.boolean().default(false) }),
        response: { 200: z.any(), 401: errorResponseSchema },
      },
    },
    async (request) => {
      const started = Date.now();
      let database: { ok: boolean; ms: number | null; sizeMb: number | null } = {
        ok: false,
        ms: null,
        sizeMb: null,
      };
      try {
        const rows = await prisma.$queryRaw<
          { size: bigint }[]
        >`SELECT pg_database_size(current_database()) AS size`;
        database = {
          ok: true,
          ms: Date.now() - started,
          sizeMb: rows[0] ? Math.round(Number(rows[0].size) / 1_048_576) : null,
        };
      } catch {
        // Shown as down.
      }
      const day = new Date().toISOString().slice(0, 10);
      const [counters, errors] = await Promise.all([
        prisma.dailyCounter.findMany({ where: { day } }).catch(() => []),
        prisma.errorLog
          .findMany({
            orderBy: [{ resolvedAt: { sort: 'desc', nulls: 'first' } }, { lastSeen: 'desc' }],
            take: 60,
          })
          .catch(() => []),
      ]);
      const counter = (key: string) => counters.find((c) => c.key === key)?.count ?? 0;
      const memory = process.memoryUsage();
      return {
        app: responseTimes(),
        database,
        server: {
          uptimeSeconds: Math.round(process.uptime()),
          memoryMb: Math.round(memory.rss / 1_048_576),
          memoryPercent: Math.round(((totalmem() - freemem()) / totalmem()) * 100),
          node: process.version,
        },
        banks: await checkBankSites(request.query.recheck),
        reading: {
          geminiCalls: counter('gemini_calls'),
          rateLimited: counter('gemini_rate_limited'),
          ocrFallback: counter('ocr_fallback'),
          geminiConfigured: Boolean(env.GEMINI_API_KEY),
        },
        errors: errors.map((e) => ({
          id: e.id,
          area: e.area,
          cause: e.cause,
          route: e.route,
          count: e.count,
          firstSeen: iso(e.firstSeen),
          lastSeen: iso(e.lastSeen),
          resolvedAt: iso(e.resolvedAt),
        })),
      };
    }
  );

  app.post(
    '/admin/errors/:id/resolve',
    {
      schema: {
        tags,
        security,
        params: idParams,
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const row = await prisma.errorLog.findUnique({ where: { id: request.params.id } });
      if (!row) throw new AppError('NOT_FOUND');
      await prisma.errorLog.update({ where: { id: row.id }, data: { resolvedAt: new Date() } });
      await log(request, {
        category: 'rules',
        action: 'resolved_error',
        details: { cause: row.cause },
      });
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/admin/alerts/test',
    {
      schema: {
        tags,
        security,
        description: 'Sends a test Telegram message (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID).',
        response: { 200: z.object({ sent: z.boolean() }), 401: errorResponseSchema },
      },
    },
    async (request) => ({
      sent: await sendTelegram(env, `ገብቷል: test message from ${request.admin.admin.name}.`),
    })
  );

  // ─── Messages ──────────────────────────────────────────────────────────
  app.get(
    '/admin/announcements',
    { schema: { tags, security, response: { 200: z.any(), 401: errorResponseSchema } } },
    async () => {
      const rows = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { createdBy: { select: { name: true } } },
      });
      const now = new Date();
      return rows.map((a) => ({
        id: a.id,
        bodyEn: a.bodyEn,
        bodyAm: a.bodyAm,
        audience: a.audience,
        plan: a.plan,
        city: a.city,
        showFrom: iso(a.showFrom),
        hideOn: iso(a.hideOn),
        createdBy: a.createdBy.name,
        state: a.hideOn <= now ? 'ended' : a.showFrom > now ? 'scheduled' : 'showing',
      }));
    }
  );

  app.post(
    '/admin/announcements',
    {
      schema: {
        tags,
        security,
        body: z
          .object({
            bodyEn: z.string().trim().min(3).max(300),
            bodyAm: z.string().trim().min(3).max(300),
            audience: z.enum(['all', 'plan', 'city']),
            plan: planSchema.optional(),
            city: z.string().trim().min(2).max(60).optional(),
            showFrom: z.string().datetime(),
            hideOn: z.string().datetime(),
          })
          .refine((b) => b.audience !== 'plan' || b.plan, 'plan')
          .refine((b) => b.audience !== 'city' || b.city, 'city')
          .refine((b) => new Date(b.hideOn) > new Date(b.showFrom), 'dates'),
        response: { 204: z.null(), 400: errorResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const b = request.body;
      await prisma.announcement.create({
        data: {
          bodyEn: b.bodyEn,
          bodyAm: b.bodyAm,
          audience: b.audience,
          plan: b.audience === 'plan' ? (b.plan ?? null) : null,
          city: b.audience === 'city' ? (b.city ?? null) : null,
          showFrom: new Date(b.showFrom),
          hideOn: new Date(b.hideOn),
          createdById: request.admin.admin.id,
        },
      });
      await log(request, {
        category: 'customers',
        action: 'sent_announcement',
        details: { audience: b.audience, plan: b.plan ?? null, city: b.city ?? null },
      });
      return reply.status(204).send(null);
    }
  );

  app.post(
    '/admin/announcements/:id/end',
    {
      schema: {
        tags,
        security,
        params: idParams,
        response: { 204: z.null(), 401: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const row = await prisma.announcement.findUnique({ where: { id: request.params.id } });
      if (!row) throw new AppError('NOT_FOUND');
      await prisma.announcement.update({ where: { id: row.id }, data: { hideOn: new Date() } });
      await log(request, { category: 'customers', action: 'ended_announcement' });
      return reply.status(204).send(null);
    }
  );

  // ─── Your account ──────────────────────────────────────────────────────
  app.patch(
    '/admin/me',
    {
      schema: {
        tags,
        security,
        body: z.object({
          idleTimeoutMinutes: z.union([z.literal(30), z.literal(120), z.literal(480)]),
        }),
        response: { 204: z.null(), 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await prisma.adminUser.update({
        where: { id: request.admin.admin.id },
        data: { idleTimeoutMinutes: request.body.idleTimeoutMinutes },
      });
      await log(request, {
        category: 'sign_in',
        action: 'changed_idle_timeout',
        details: {
          from: request.admin.admin.idleTimeoutMinutes,
          to: request.body.idleTimeoutMinutes,
        },
      });
      return reply.status(204).send(null);
    }
  );

  app.get(
    '/admin/sessions',
    {
      schema: {
        tags,
        security,
        response: { 200: z.object({ others: z.number().int() }), 401: errorResponseSchema },
      },
    },
    async (request) => ({
      others: await prisma.adminSession.count({
        where: {
          adminId: request.admin.admin.id,
          id: { not: request.admin.sessionId },
          stage: 'full',
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    })
  );

  app.post(
    '/admin/sessions/sign-out-others',
    { schema: { tags, security, response: { 204: z.null(), 401: errorResponseSchema } } },
    async (request, reply) => {
      await prisma.adminSession.updateMany({
        where: {
          adminId: request.admin.admin.id,
          id: { not: request.admin.sessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await log(request, { category: 'sign_in', action: 'signed_out_others' });
      return reply.status(204).send(null);
    }
  );

  app.get(
    '/admin/activity.csv',
    { schema: { tags, security, description: 'The whole activity log as CSV (last 5,000 rows).' } },
    async (request, reply) => {
      const rows = await prisma.adminActivity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: { admin: { select: { name: true } } },
      });
      const names = new Map(
        (
          await prisma.business.findMany({
            where: {
              id: { in: [...new Set(rows.flatMap((r) => (r.businessId ? [r.businessId] : [])))] },
            },
            select: { id: true, name: true },
          })
        ).map((b) => [b.id, b.name])
      );
      await log(request, {
        category: 'private_data',
        action: 'exported_activity',
        details: { rows: rows.length },
      });
      const lines = rows.map((r) =>
        [
          r.createdAt.toISOString(),
          r.admin?.name ?? '',
          r.category,
          r.action,
          r.businessId ? (names.get(r.businessId) ?? '') : '',
          r.details ? JSON.stringify(r.details) : '',
          r.ip ?? '',
        ]
          .map(csvCell)
          .join(',')
      );
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="activity.csv"')
        .send(
          `${EXCEL_BOM}${[['When', 'Who', 'Category', 'What', 'Customer', 'Details', 'IP'].map(csvCell).join(','), ...lines].join('\r\n')}`
        );
    }
  );
};
