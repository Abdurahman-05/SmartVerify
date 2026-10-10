import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import type { Plan, Role } from '../generated/prisma/client.js';
import { hashSessionToken, newSessionToken } from '../services/session-token.js';

import { testDatabaseUrl } from './test-database.js';

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

export async function createTestApp() {
  const app = await buildApp({ env: loadEnv(), logger: false });
  await app.ready();
  return app;
}

/** Tables these tests write to. Always schema-qualified, so only the test schema is emptied. */
const USED_TABLES = [
  'KitchenOrder',
  'OrderItem',
  'Order',
  'Bill',
  'MenuItem',
  'RestaurantTable',
  'DeliveryArea',
  'Session',
  'BusinessMember',
  'Business',
  'User',
];

export async function resetDatabase(app: TestApp) {
  const { schema } = testDatabaseUrl();
  const list = USED_TABLES.map((t) => `"${schema}"."${t}"`).join(', ');
  await app.prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

let phoneCounter = 0;
/** Unique valid phones (9 digits starting with 7). */
const nextPhone = () => `7${String(++phoneCounter).padStart(8, '0')}`;

export interface TestMember {
  memberId: string;
  name: string;
  token: string;
}

/** A member with a live session (sign-in itself is covered by the auth tests). */
export async function addMember(
  app: TestApp,
  businessId: string,
  role: Role,
  options: { name?: string; canChangeDeliveryFee?: boolean; userId?: string } = {}
): Promise<TestMember> {
  const name = options.name ?? `${role} ${phoneCounter + 1}`;
  const userId =
    options.userId ??
    (await app.prisma.user.create({ data: { name, phone: nextPhone(), pinHash: 'not-used' } })).id;
  const member = await app.prisma.businessMember.create({
    data: { businessId, userId, role, canChangeDeliveryFee: options.canChangeDeliveryFee ?? false },
  });
  const token = newSessionToken();
  await app.prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      memberId: member.id,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return { memberId: member.id, name, token };
}

/** A restaurant business with staff, 3 active tables (+1 inactive), a menu and a delivery area. */
export async function createRestaurant(app: TestApp, plan: Plan | null = 'restaurant') {
  const ownerUser = await app.prisma.user.create({
    data: { name: 'Owner Abebe', phone: nextPhone(), pinHash: 'not-used' },
  });
  const business = await app.prisma.business.create({
    data: { name: 'Test Cafe', ownerId: ownerUser.id, plan, packingFeeEtb: 30 },
  });
  const businessId = business.id;
  const owner = await addMember(app, businessId, 'owner', {
    name: 'Owner Abebe',
    userId: ownerUser.id,
  });
  const manager = await addMember(app, businessId, 'manager', { name: 'Manager Yonas' });
  const waiter = await addMember(app, businessId, 'waiter', { name: 'Waiter Dawit' });
  const waiter2 = await addMember(app, businessId, 'waiter', { name: 'Waiter Selam' });
  const feeWaiter = await addMember(app, businessId, 'waiter', {
    name: 'Waiter Fee',
    canChangeDeliveryFee: true,
  });
  const chef = await addMember(app, businessId, 'chef', { name: 'Chef Hana' });

  const tableData = [1, 2, 3].map((number) => ({ businessId, number, area: 'main' as const }));
  await app.prisma.restaurantTable.createMany({
    data: [...tableData, { businessId, number: 9, area: 'main', active: false }],
  });
  const tables = await app.prisma.restaurantTable.findMany({
    where: { businessId },
    orderBy: { number: 'asc' },
  });

  const tibs = await app.prisma.menuItem.create({
    data: { businessId, name: 'Tibs', priceEtb: 450, category: 'food' },
  });
  const coffee = await app.prisma.menuItem.create({
    data: { businessId, name: 'Coffee', priceEtb: 60, category: 'drinks' },
  });
  const retired = await app.prisma.menuItem.create({
    data: { businessId, name: 'Old dish', priceEtb: 100, category: 'food', active: false },
  });
  const bole = await app.prisma.deliveryArea.create({
    data: { businessId, name: 'Bole', usualFeeEtb: 80 },
  });

  return {
    businessId,
    owner,
    manager,
    waiter,
    waiter2,
    feeWaiter,
    chef,
    tables,
    menu: { tibs, coffee, retired },
    bole,
  };
}

export type Restaurant = Awaited<ReturnType<typeof createRestaurant>>;

let keyCounter = 0;
export const newKey = () => `test-key-${Date.now()}-${++keyCounter}`;

export const headers = (token: string, idempotencyKey?: string) => ({
  authorization: `Bearer ${token}`,
  ...(idempotencyKey && { 'idempotency-key': idempotencyKey }),
});
