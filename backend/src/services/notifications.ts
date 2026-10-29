import type { FastifyBaseLogger } from 'fastify';

import type { Prisma, PrismaClient, Role } from '../generated/prisma/client.js';
import { businessAccess } from './business-access.js';
import { getSettings } from './platform-settings.js';

export type NotificationType =
  | 'new_order'
  | 'order_ready'
  | 'big_payment'
  | 'bad_receipt'
  | 'daily_summary'
  | 'plan_ending'
  | 'plan_late';

/** Who is told: every active member with one of these roles, and/or these members. */
export interface Recipients {
  roles?: Role[];
  memberIds?: string[];
}

/**
 * Adds a notification to each recipient's inbox. Never fails the action that caused it: a
 * problem here is only logged. onceKey: sent at most once per person for that key.
 */
export async function notify(
  prisma: PrismaClient,
  log: FastifyBaseLogger | undefined,
  input: {
    businessId: string;
    to: Recipients;
    type: NotificationType;
    data?: Prisma.InputJsonObject;
    onceKey?: string;
  }
) {
  try {
    const { roles = [], memberIds = [] } = input.to;
    const members = await prisma.businessMember.findMany({
      where: {
        businessId: input.businessId,
        active: true,
        OR: [{ role: { in: roles } }, { id: { in: memberIds } }],
      },
      select: { id: true },
    });
    if (members.length === 0) return;
    await prisma.notification.createMany({
      data: members.map((m) => ({
        businessId: input.businessId,
        memberId: m.id,
        type: input.type,
        data: input.data ?? {},
        onceKey: input.onceKey ?? null,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    log?.error({ err: error, type: input.type }, 'could not save a notification');
  }
}

const OWNER_AND_MANAGERS: Role[] = ['owner', 'manager'];

/** "2026-10-29" in Addis Ababa (UTC+3), and the hour there. */
function addisDay(now: Date) {
  const addis = new Date(now.getTime() + 3 * 3_600_000);
  return { day: addis.toISOString().slice(0, 10), hour: addis.getUTCHours() };
}

/** The daily summary goes out after this hour (Addis Ababa time). */
export const SUMMARY_HOUR = 21;

/**
 * Run every hour: the evening summary of the day's verified payments, and the owner's plan
 * reminders (days before the end, then late / restricted / suspended). Each one only once.
 */
export async function sendScheduledNotifications(
  prisma: PrismaClient,
  log: FastifyBaseLogger | undefined,
  now = new Date()
) {
  const { day, hour } = addisDay(now);
  const settings = await getSettings(prisma);
  const businesses = await prisma.business.findMany({
    where: { deactivatedAt: null },
    select: { id: true },
  });

  for (const { id: businessId } of businesses) {
    if (hour >= SUMMARY_HOUR) {
      // Midnight in Addis Ababa is 21:00 UTC the day before.
      const from = new Date(`${day}T00:00:00+03:00`);
      const today = await prisma.transaction.aggregate({
        where: { businessId, status: 'verified', createdAt: { gte: from, lte: now } },
        _count: true,
        _sum: { receivedAmount: true },
      });
      if (today._count > 0) {
        await notify(prisma, log, {
          businessId,
          to: { roles: OWNER_AND_MANAGERS },
          type: 'daily_summary',
          data: { day, count: today._count, totalEtb: today._sum.receivedAmount ?? 0 },
          onceKey: `daily_summary:${day}`,
        });
      }
    }

    const access = await businessAccess(prisma, businessId, now);
    const end = access.endsAt?.toISOString().slice(0, 10) ?? 'none';
    if (access.status === 'trial' || access.status === 'active') {
      const days = access.daysLeft;
      if (days !== null && !access.exempt && settings.reminderDays.includes(days)) {
        await notify(prisma, log, {
          businessId,
          to: { roles: ['owner'] },
          type: 'plan_ending',
          data: { daysLeft: days, endsAt: access.endsAt?.toISOString() ?? null },
          onceKey: `plan_ending:${end}:${days}`,
        });
      }
    } else if (!access.suspendedByAdmin) {
      await notify(prisma, log, {
        businessId,
        to: { roles: ['owner'] },
        type: 'plan_late',
        data: { status: access.status, nextStepAt: access.nextStepAt?.toISOString() ?? null },
        onceKey: `plan_late:${end}:${access.status}`,
      });
    }
  }
}
