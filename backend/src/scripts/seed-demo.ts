import { loadEnv } from '../config/env.js';
import type { Role } from '../generated/prisma/client.js';
import { createPrismaClient } from '../plugins/prisma.js';
import { hashPin } from '../services/pin-hasher.js';

/**
 * A ready demo restaurant for testing on the phone (never in production):
 *   npm run seed:demo
 * Owner, manager, waiter and chef with fixed phones and PINs, a small menu, 5 tables, a
 * delivery area and a receiving account. Running it again resets the PINs and changes nothing else.
 */
const BUSINESS = 'Demo Restaurant';
const PEOPLE: { role: Role; name: string; phone: string; pin: string }[] = [
  { role: 'owner', name: 'Demo Owner', phone: '911000001', pin: '123456' },
  { role: 'manager', name: 'Demo Manager', phone: '911000002', pin: '1234' },
  { role: 'waiter', name: 'Demo Waiter', phone: '911000003', pin: '1234' },
  { role: 'chef', name: 'Demo Chef', phone: '911000004', pin: '1234' },
];
const MENU = [
  { name: 'Beef Tibs', priceEtb: 450, kind: 'food' as const },
  { name: 'Shiro', priceEtb: 180, kind: 'food' as const },
  { name: 'Doro Wat', priceEtb: 520, kind: 'food' as const },
  { name: 'Coffee', priceEtb: 40, kind: 'drinks' as const },
  { name: 'Soft drink', priceEtb: 60, kind: 'drinks' as const },
];

async function main() {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') {
    console.error('Demo accounts are for local testing only.');
    process.exit(1);
  }
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const taken = await prisma.user.findMany({
      where: { phone: { in: PEOPLE.map((p) => p.phone) } },
      include: { membership: { include: { business: { select: { name: true } } } } },
    });
    const elsewhere = taken.find((u) => u.membership?.business.name !== BUSINESS);
    if (elsewhere) {
      console.error(`Phone ${elsewhere.phone} already belongs to another business; nothing done.`);
      process.exit(1);
    }

    if (taken.length > 0) {
      // Already there: put the PINs back, sign everyone out.
      for (const p of PEOPLE) {
        await prisma.user.updateMany({
          where: { phone: p.phone },
          data: { pinHash: await hashPin(p.pin), pinIsTemporary: false },
        });
      }
      await prisma.session.updateMany({
        where: { user: { phone: { in: PEOPLE.map((p) => p.phone) } }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      console.log(`${BUSINESS} already exists: PINs reset.`);
    } else {
      const [ownerInfo, ...staff] = PEOPLE;
      if (!ownerInfo) return;
      await prisma.$transaction(async (tx) => {
        const owner = await tx.user.create({
          data: {
            name: ownerInfo.name,
            phone: ownerInfo.phone,
            pinHash: await hashPin(ownerInfo.pin),
          },
        });
        const business = await tx.business.create({
          data: { name: BUSINESS, ownerId: owner.id, plan: 'restaurant', city: 'Addis Ababa' },
        });
        const businessId = business.id;
        await tx.businessMember.create({ data: { businessId, userId: owner.id, role: 'owner' } });
        for (const p of staff) {
          const user = await tx.user.create({
            data: { name: p.name, phone: p.phone, pinHash: await hashPin(p.pin) },
          });
          await tx.businessMember.create({
            data: {
              businessId,
              userId: user.id,
              role: p.role,
              canSeeReports: p.role === 'manager',
            },
          });
        }

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
        await tx.bankAccount.create({
          data: {
            businessId,
            bankCode: 'CBE',
            accountNumber: '1000123456789',
            last4: '6789',
            holderName: BUSINESS,
          },
        });
      });
      console.log(`${BUSINESS} created (Restaurant Plus, 14-day trial).`);
    }

    console.log('\nSign in with (phone without +251):');
    for (const p of PEOPLE) {
      console.log(`  ${p.role.padEnd(8)} ${p.name.padEnd(13)} phone ${p.phone}   PIN ${p.pin}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
