/**
 * Development seed. Refuses to run in production.
 * Creates the same demo business the app's mocks use (docs/BACKEND.md §7). Re-running resets it.
 *
 *   Owner    Abebe     912345678 · 123456  (Restaurant Plus)
 *   Waiter   Dawit G.  911111111 · 1111
 *   Waiter   Selam T.  922222222 · 2222
 *   Chef     Hana M.   933333333 · 3333
 *   Manager  Yonas B.  944444444 · 4444   (inactive)
 */
import { loadEnv } from '../src/config/env.js';
import type { Role } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../src/plugins/prisma.js';
import { hashPin } from '../src/services/pin-hasher.js';

const env = loadEnv();
if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const prisma = createPrismaClient(env.DATABASE_URL);

const OWNER_PHONE = '912345678';
const staff: {
  name: string;
  phone: string;
  pin: string;
  role: Role;
  active: boolean;
  reports?: boolean;
}[] = [
  { name: 'Dawit G.', phone: '911111111', pin: '1111', role: 'waiter', active: true },
  { name: 'Selam T.', phone: '922222222', pin: '2222', role: 'waiter', active: true },
  { name: 'Hana M.', phone: '933333333', pin: '3333', role: 'chef', active: true },
  {
    name: 'Yonas B.',
    phone: '944444444',
    pin: '4444',
    role: 'manager',
    active: false,
    reports: true,
  },
];

const menu = [
  ['Special Firfir', 190, 'food'],
  ['Doro Wat', 150, 'food'],
  ['Shiro Tegabino', 110, 'food'],
  ['Beef Tibs', 220, 'food'],
  ['Kitfo', 260, 'food'],
  ['Beyaynetu', 140, 'food'],
  ['Buna (Coffee)', 40, 'drinks'],
  ['Shai (Tea)', 30, 'drinks'],
  ['Avocado Juice', 90, 'drinks'],
  ['Water 1L', 35, 'drinks'],
  ['Soft drink', 45, 'drinks'],
  ['Ambo Sparkling Water', 45, 'drinks'],
  ['Family Combo', 650, 'combos'],
  ['Fasting Combo', 320, 'combos'],
] as const;

const deliveryAreas = [
  ['Bole', 80],
  ['Kazanchis', 100],
  ['Megenagna', 100],
  ['Sarbet', 120],
  ['Piassa', 120],
  ['CMC', 150],
] as const;

async function removeDemoBusiness() {
  const phones = [OWNER_PHONE, ...staff.map((s) => s.phone)];
  const owner = await prisma.user.findUnique({
    where: { phone: OWNER_PHONE },
    include: { ownedBusiness: true },
  });
  const businessId = owner?.ownedBusiness?.id;
  if (businessId) {
    const where = { businessId };
    await prisma.kitchenOrder.deleteMany({ where });
    await prisma.tip.deleteMany({ where });
    await prisma.payment.deleteMany({ where });
    await prisma.billItem.deleteMany({ where: { bill: { businessId } } });
    await prisma.bill.deleteMany({ where });
    await prisma.orderItem.deleteMany({ where: { order: { businessId } } });
    await prisma.order.deleteMany({ where });
    await prisma.verificationAttempt.deleteMany({ where });
    await prisma.transaction.deleteMany({ where });
    await prisma.bankAccount.deleteMany({ where });
    await prisma.menuItem.deleteMany({ where });
    await prisma.restaurantTable.deleteMany({ where });
    await prisma.deliveryArea.deleteMany({ where });
    await prisma.subscription.deleteMany({ where });
    await prisma.session.deleteMany({ where: { member: { businessId } } });
    await prisma.businessMember.deleteMany({ where });
    await prisma.business.delete({ where: { id: businessId } });
  }
  await prisma.session.deleteMany({ where: { user: { phone: { in: phones } } } });
  await prisma.businessMember.deleteMany({ where: { user: { phone: { in: phones } } } });
  await prisma.user.deleteMany({ where: { phone: { in: phones } } });
}

async function main() {
  await removeDemoBusiness();

  const owner = await prisma.user.create({
    data: { name: 'Abebe', phone: OWNER_PHONE, pinHash: await hashPin('123456') },
  });
  const business = await prisma.business.create({
    data: { name: 'Abebe Coffee', ownerId: owner.id, plan: 'restaurant', packingFeeEtb: 30 },
  });
  await prisma.businessMember.create({
    data: { businessId: business.id, userId: owner.id, role: 'owner' },
  });

  for (const s of staff) {
    const user = await prisma.user.create({
      data: { name: s.name, phone: s.phone, pinHash: await hashPin(s.pin) },
    });
    await prisma.businessMember.create({
      data: {
        businessId: business.id,
        userId: user.id,
        role: s.role,
        active: s.active,
        canSeeReports: s.role === 'manager' || Boolean(s.reports),
        canChangeDeliveryFee: s.role === 'manager',
      },
    });
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
  await prisma.subscription.create({
    data: {
      businessId: business.id,
      plan: 'restaurant',
      period: 'monthly',
      priceEtb: 4000,
      startedAt,
      endsAt,
    },
  });

  await prisma.bankAccount.createMany({
    data: [
      {
        businessId: business.id,
        bankCode: 'CBE',
        accountNumber: '1000293884582',
        last4: '4582',
        holderName: 'Abebe Coffee',
      },
      {
        businessId: business.id,
        bankCode: 'TEL',
        accountNumber: '0911227788',
        last4: '7788',
        holderName: 'Abebe Coffee',
      },
      {
        businessId: business.id,
        bankCode: 'AWA',
        accountNumber: '01320456781290',
        last4: '1290',
        holderName: 'Abebe Coffee',
      },
    ],
  });

  await prisma.menuItem.createMany({
    data: menu.map(([name, priceEtb, category], sortOrder) => ({
      businessId: business.id,
      name,
      priceEtb,
      category,
      sortOrder,
    })),
  });

  const tables = (
    [
      ['main', 16],
      ['upstairs', 8],
      ['outside', 6],
    ] as const
  ).flatMap(([area, count]) =>
    Array.from({ length: count }, (_, i) => ({ businessId: business.id, area, number: i + 1 }))
  );
  await prisma.restaurantTable.createMany({ data: tables });

  await prisma.deliveryArea.createMany({
    data: deliveryAreas.map(([name, usualFeeEtb]) => ({
      businessId: business.id,
      name,
      usualFeeEtb,
    })),
  });

  console.warn(
    `Seeded demo business "${business.name}" with ${staff.length} staff (development only).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
