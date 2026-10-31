import { loadEnv } from '../config/env.js';
import type { Plan, Prisma, PrismaClient, Role } from '../generated/prisma/client.js';
import { createPrismaClient } from '../plugins/prisma.js';
import { hashPin } from '../services/pin-hasher.js';

/**
 * Ready demo businesses for testing on the phone (never in production):
 *   npm run seed:demo
 * A restaurant (Restaurant Plus: owner, manager, waiter, chef, menu, tables) for the Restaurant
 * app, and two shops for the Shop app (Normal: owner + 2 workers; Normal Multi: owner + 3
 * workers). Each has a receiving account and a paid plan for a year. Running it again resets the
 * PINs (and signs those accounts out) and changes nothing else.
 */
interface Person {
  role: Role;
  name: string;
  phone: string;
  pin: string;
}
interface Demo {
  name: string;
  plan: Plan;
  people: Person[];
  /** Menu, tables and a delivery area (restaurants). */
  restaurant?: boolean;
}

const DEMOS: Demo[] = [
  {
    name: 'Demo Restaurant',
    plan: 'restaurant',
    restaurant: true,
    people: [
      { role: 'owner', name: 'Demo Owner', phone: '911000001', pin: '123456' },
      { role: 'manager', name: 'Demo Manager', phone: '911000002', pin: '1234' },
      { role: 'waiter', name: 'Demo Waiter', phone: '911000003', pin: '1234' },
      { role: 'chef', name: 'Demo Chef', phone: '911000004', pin: '1234' },
    ],
  },
  {
    name: 'Demo Shop',
    plan: 'normal',
    people: [
      { role: 'owner', name: 'Shop Owner', phone: '911000011', pin: '123456' },
      { role: 'waiter', name: 'Shop Worker 1', phone: '911000012', pin: '1234' },
      { role: 'waiter', name: 'Shop Worker 2', phone: '911000013', pin: '1234' },
    ],
  },
  {
    name: 'Demo Shop Multi',
    plan: 'normal_multi',
    people: [
      { role: 'owner', name: 'Multi Owner', phone: '911000021', pin: '123456' },
      { role: 'waiter', name: 'Branch 1 Worker', phone: '911000022', pin: '1234' },
      { role: 'waiter', name: 'Branch 2 Worker', phone: '911000023', pin: '1234' },
      { role: 'waiter', name: 'Branch 3 Worker', phone: '911000024', pin: '1234' },
    ],
  },
];

const MENU = [
  { name: 'Beef Tibs', priceEtb: 450, kind: 'food' as const },
  { name: 'Shiro', priceEtb: 180, kind: 'food' as const },
  { name: 'Doro Wat', priceEtb: 520, kind: 'food' as const },
  { name: 'Coffee', priceEtb: 40, kind: 'drinks' as const },
  { name: 'Soft drink', priceEtb: 60, kind: 'drinks' as const },
];

const PLAN_NAMES: Record<Plan, string> = {
  normal: 'Normal (Shop app)',
  normal_multi: 'Normal Multi (Shop app)',
  restaurant_normal: 'Normal Verify (Restaurant app)',
  restaurant: 'Restaurant Plus (Restaurant app)',
};

/** Prints one line (the linter keeps console for warnings and errors). */
const say = (line: string) => process.stdout.write(line + '\n');

/** Menu, tables, a delivery area. */
async function setUpRestaurant(tx: Prisma.TransactionClient, businessId: string) {
  const floor = await tx.tableCategory.create({
    data: { businessId, name: 'Main Floor', nameAm: 'ዋናው ወለል' },
  });
  await tx.restaurantTable.createMany({
    data: [1, 2, 3, 4, 5].map((number) => ({ businessId, number, categoryId: floor.id })),
  });
  const food = await tx.itemCategory.create({
    data: { businessId, name: 'Food', kind: 'food', sortOrder: 0 },
  });
  const drinks = await tx.itemCategory.create({
    data: { businessId, name: 'Drinks', kind: 'drinks', sortOrder: 1 },
  });
  await tx.menuItem.createMany({
    data: MENU.map((m) => ({
      businessId,
      name: m.name,
      priceEtb: m.priceEtb,
      category: m.kind,
      categoryId: m.kind === 'food' ? food.id : drinks.id,
    })),
  });
  await tx.deliveryArea.create({ data: { businessId, name: 'Bole', usualFeeEtb: 80 } });
}

/** Creates the business (or resets its PINs) and makes sure it has a paid year. */
async function seed(prisma: PrismaClient, demo: Demo, accountDigits: string) {
  const phones = demo.people.map((p) => p.phone);
  const taken = await prisma.user.findMany({
    where: { phone: { in: phones } },
    include: { membership: { include: { business: { select: { name: true } } } } },
  });
  const elsewhere = taken.find((u) => u.membership?.business.name !== demo.name);
  if (elsewhere) {
    console.error(`Phone ${elsewhere.phone} belongs to another business; ${demo.name} skipped.`);
    return;
  }

  let businessId: string;
  if (taken.length > 0) {
    // Already there: put the PINs back, sign those accounts out.
    for (const p of demo.people) {
      await prisma.user.updateMany({
        where: { phone: p.phone },
        data: { pinHash: await hashPin(p.pin), pinIsTemporary: false },
      });
    }
    await prisma.session.updateMany({
      where: { user: { phone: { in: phones } }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    businessId = taken[0]!.membership!.businessId;
    say(`${demo.name}: already there, PINs reset.`);
  } else {
    const [ownerInfo, ...staff] = demo.people;
    if (!ownerInfo) return;
    businessId = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          name: ownerInfo.name,
          phone: ownerInfo.phone,
          pinHash: await hashPin(ownerInfo.pin),
        },
      });
      const business = await tx.business.create({
        data: { name: demo.name, ownerId: owner.id, plan: demo.plan, city: 'Addis Ababa' },
      });
      await tx.businessMember.create({
        data: { businessId: business.id, userId: owner.id, role: 'owner' },
      });
      for (const p of staff) {
        const user = await tx.user.create({
          data: { name: p.name, phone: p.phone, pinHash: await hashPin(p.pin) },
        });
        await tx.businessMember.create({
          data: {
            businessId: business.id,
            userId: user.id,
            role: p.role,
            canSeeReports: p.role === 'manager',
          },
        });
      }
      if (demo.restaurant) await setUpRestaurant(tx, business.id);
      await tx.bankAccount.create({
        data: {
          businessId: business.id,
          bankCode: 'CBE',
          accountNumber: accountDigits,
          last4: accountDigits.slice(-4),
          holderName: demo.name,
        },
      });
      return business.id;
    });
    say(`${demo.name}: created.`);
  }

  // The right plan, paid for a year (local testing only).
  await prisma.business.update({ where: { id: businessId }, data: { plan: demo.plan } });
  const active = await prisma.subscription.findFirst({
    where: { businessId, status: 'active', plan: demo.plan, endsAt: { gt: new Date() } },
  });
  if (!active) {
    const now = new Date();
    await prisma.subscription.updateMany({
      where: { businessId, status: 'active' },
      data: { status: 'cancelled' },
    });
    await prisma.subscription.create({
      data: {
        businessId,
        plan: demo.plan,
        period: 'monthly',
        priceEtb: 0,
        startedAt: now,
        endsAt: new Date(now.getTime() + 365 * 86_400_000),
        paymentMethod: 'manual',
        note: 'Local demo',
      },
    });
  }
}

async function main() {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') {
    console.error('Demo accounts are for local testing only.');
    process.exit(1);
  }
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    // Made-up receiving accounts, one per business.
    const accounts = ['1000123456789', '1000123456711', '1000123456722'];
    for (const [i, demo] of DEMOS.entries()) await seed(prisma, demo, accounts[i]!);

    say('\nSign in with (phone without +251); each business is paid for a year:');
    for (const demo of DEMOS) {
      say(`\n${demo.name} · ${PLAN_NAMES[demo.plan]}`);
      for (const p of demo.people) {
        const role = p.role === 'waiter' && !demo.restaurant ? 'worker' : p.role;
        say(`  ${role.padEnd(8)} ${p.name.padEnd(16)} phone ${p.phone}   PIN ${p.pin}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
