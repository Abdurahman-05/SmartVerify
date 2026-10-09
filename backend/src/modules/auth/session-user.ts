import { z } from 'zod';

import type { PrismaClient } from '../../generated/prisma/client.js';
import { planSchema, roleSchema } from '../../shared/schemas/common.js';

export const subscriptionSchema = z.object({
  plan: planSchema,
  period: z.enum(['monthly', 'quarterly']),
  priceEtb: z.number().int(),
  startedAt: z.string(),
  endsAt: z.string(),
});

/** Same shape as the app's `SessionUser` (src/store/session.ts). Staff get the owner's plan. */
export const sessionUserSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  businessName: z.string(),
  phone: z.string(),
  role: roleSchema,
  plan: planSchema.nullable(),
  subscription: subscriptionSchema.nullable(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export async function currentSubscription(prisma: PrismaClient, businessId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { businessId, status: 'active', endsAt: { gt: new Date() } },
    orderBy: { startedAt: 'desc' },
  });
  return sub
    ? {
        plan: sub.plan,
        period: sub.period,
        priceEtb: sub.priceEtb,
        startedAt: sub.startedAt.toISOString(),
        endsAt: sub.endsAt.toISOString(),
      }
    : null;
}

export async function loadSessionUser(
  prisma: PrismaClient,
  memberId: string
): Promise<SessionUser> {
  const member = await prisma.businessMember.findUniqueOrThrow({
    where: { id: memberId },
    include: { user: true, business: true },
  });
  return {
    userId: member.userId,
    displayName: member.user.name,
    businessName: member.business.name,
    phone: member.user.phone,
    role: member.role,
    plan: member.business.plan,
    subscription: await currentSubscription(prisma, member.businessId),
  };
}
