import { randomUUID } from 'node:crypto';

import { loadEnv } from '../config/env.js';
import type {
  BillType,
  PaidFrom,
  PaymentMethod,
  Prisma,
  SpendingCategory,
} from '../generated/prisma/client.js';
import { createPrismaClient } from '../plugins/prisma.js';
import { hashPin } from '../services/pin-hasher.js';

/**
 * Demo activity for one restaurant, so Home, Overview, Reports, Tips, Money flow and Buy list
 * have something to show:
 *   npm run seed:activity                 (the business of phone 911000001)
 *   DEMO_PHONE=9xxxxxxxx npm run seed:activity
 * Adds 30 days of paid bills (dine in, takeaway, delivery; cash, bank, cash+bank), tips for every
 * waiter, a few cancelled orders, failed receipt checks, spendings and buy-list items, plus a
 * few open tables right now. Also adds demo waiters and menu items when there are only a few.
 * Runs once per business; DEMO_RESEED=yes adds another round. Never on production unless
 * DEMO_IN_PRODUCTION=yes.
 */

const DAYS = 30;
const MARK = 'demo-activity';
/** Addis Ababa is UTC+3 all year. */
const ADDIS_OFFSET_H = 3;

const EXTRA_WAITERS = [
  { name: 'Dawit', phone: '911000101' },
  { name: 'Almaz', phone: '911000102' },
  { name: 'Hana', phone: '911000103' },
  { name: 'Kebede', phone: '911000104' },
  { name: 'Yonas', phone: '911000105' },
];

const EXTRA_MENU: { name: string; nameAm: string; priceEtb: number; kind: 'food' | 'drinks' }[] = [
  { name: 'Special Tibs', nameAm: 'ስፔሻል ጥብስ', priceEtb: 320, kind: 'food' },
  { name: 'Kitfo', nameAm: 'ክትፎ', priceEtb: 480, kind: 'food' },
  { name: 'Firfir', nameAm: 'ፍርፍር', priceEtb: 160, kind: 'food' },
  { name: 'Beyaynetu', nameAm: 'በያይነቱ', priceEtb: 220, kind: 'food' },
  { name: 'Macchiato', nameAm: 'ማኪያቶ', priceEtb: 45, kind: 'drinks' },
  { name: 'Fresh Juice', nameAm: 'ጭማቂ', priceEtb: 90, kind: 'drinks' },
  { name: 'Tea', nameAm: 'ሻይ', priceEtb: 30, kind: 'drinks' },
  { name: 'Water', nameAm: 'ውሃ', priceEtb: 35, kind: 'drinks' },
];

const SPENDINGS: { title: string; category: SpendingCategory; min: number; max: number }[] = [
  { title: 'Cooking oil', category: 'FOOD', min: 900, max: 2200 },
  { title: 'Onions and tomatoes', category: 'FOOD', min: 300, max: 900 },
  { title: 'Meat', category: 'FOOD', min: 2500, max: 6000 },
  { title: 'Soft drinks crate', category: 'DRINKS', min: 600, max: 1400 },
  { title: 'Cooking gas', category: 'GAS', min: 900, max: 1500 },
  { title: 'Taxi for supplies', category: 'TRANSPORT', min: 100, max: 350 },
  { title: 'Electricity', category: 'BILLS', min: 800, max: 1800 },
  { title: 'Fridge repair', category: 'REPAIRS', min: 500, max: 2500 },
  { title: 'Napkins', category: 'OTHER', min: 150, max: 480 },
];

const BUY_LIST = [
  { name: 'Cooking oil', qty: '2 jerrycans' },
  { name: 'Napkins', qty: '3 boxes' },
  { name: 'Dish soap', qty: '1 pack' },
  { name: 'Charcoal', qty: '2 sacks' },
  { name: 'Berbere', qty: '1 kg' },
  { name: 'Injera', qty: '40 pieces' },
];

const CANCEL_REASONS = ['Customer changed mind', 'Wrong item', 'Took too long'];
const FAIL_REASONS: { status: 'not_matching' | 'unable_to_verify'; reasons: string[] }[] = [
  { status: 'not_matching', reasons: ['AMOUNT_TOO_LOW'] },
  { status: 'not_matching', reasons: ['WRONG_RECEIVER'] },
  { status: 'unable_to_verify', reasons: ['TIMEOUT'] },
  { status: 'unable_to_verify', reasons: ['NOT_FOUND'] },
];

const say = (line: string) => process.stdout.write(line + '\n');
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;
const chance = (p: number) => Math.random() < p;
const round10 = (n: number) => Math.round(n / 10) * 10;
const id = () => randomUUID();

/** "Today" in Addis Ababa, then a UTC Date for an Addis day offset and time. */
function addisClock() {
  const nowAddis = new Date(Date.now() + ADDIS_OFFSET_H * 3_600_000);
  const y = nowAddis.getUTCFullYear();
  const m = nowAddis.getUTCMonth();
  const d = nowAddis.getUTCDate();
  return {
    hourNow: nowAddis.getUTCHours(),
    at: (daysAgo: number, hour: number, minute: number) =>
      new Date(Date.UTC(y, m, d - daysAgo, hour - ADDIS_OFFSET_H, minute)),
  };
}

/** Busier at lunch (12–14) and dinner (18–20). */
function busyHour(maxHour: number): number {
  const weighted = [
    8, 9, 10, 11, 12, 12, 13, 13, 13, 14, 14, 15, 16, 17, 18, 18, 19, 19, 19, 20, 21,
  ];
  const allowed = weighted.filter((h) => h <= maxHour);
  return pick(allowed.length ? allowed : [8]);
}

async function main() {
  const env = loadEnv();
  if (env.NODE_ENV === 'production' && process.env.DEMO_IN_PRODUCTION !== 'yes') {
    console.error('Demo activity on production needs DEMO_IN_PRODUCTION=yes.');
    process.exit(1);
  }
  const phone = process.env.DEMO_PHONE ?? '911000001';
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { membership: { include: { business: true } } },
    });
    const business = user?.membership?.business;
    if (!business) {
      console.error(`No business for phone ${phone}. Run npm run seed:demo first.`);
      process.exit(1);
    }
    const businessId = business.id;
    const already = await prisma.payment.count({
      where: { businessId, idempotencyKey: { startsWith: MARK } },
    });
    if (already > 0 && process.env.DEMO_RESEED !== 'yes') {
      say(`${business.name} already has demo activity. DEMO_RESEED=yes adds another round.`);
      return;
    }

    // ── People: every waiter, plus demo waiters when there are fewer than 4 ──
    let waiters = await prisma.businessMember.findMany({
      where: { businessId, role: 'waiter', active: true },
      include: { user: { select: { name: true } } },
    });
    if (waiters.length < 4) {
      const pinHash = await hashPin('1234');
      for (const w of EXTRA_WAITERS) {
        if (await prisma.user.findUnique({ where: { phone: w.phone } })) continue;
        const u = await prisma.user.create({ data: { name: w.name, phone: w.phone, pinHash } });
        await prisma.businessMember.create({
          data: { businessId, userId: u.id, role: 'waiter' },
        });
        say(`  waiter ${w.name}: phone ${w.phone}, PIN 1234`);
      }
      waiters = await prisma.businessMember.findMany({
        where: { businessId, role: 'waiter', active: true },
        include: { user: { select: { name: true } } },
      });
    }
    if (waiters.length === 0) {
      console.error('The business has no waiters.');
      process.exit(1);
    }
    const managers = await prisma.businessMember.findMany({
      where: { businessId, role: { in: ['owner', 'manager'] }, active: true },
    });
    const owner = managers.find((m) => m.role === 'owner') ?? managers[0]!;
    const chefs = await prisma.businessMember.findMany({
      where: { businessId, role: 'chef', active: true },
    });
    const kitchenPerson = chefs[0] ?? owner;

    // ── Menu: add a few dishes when it is short ──
    let menu = await prisma.menuItem.findMany({
      where: { businessId, active: true, deletedAt: null },
    });
    if (menu.length < 10) {
      const cats = await prisma.itemCategory.findMany({ where: { businessId } });
      const catFor = (kind: 'food' | 'drinks') => cats.find((c) => c.kind === kind) ?? cats[0];
      const have = new Set(menu.map((m) => m.name.toLowerCase().replace(/\s/g, '')));
      const add = EXTRA_MENU.filter((m) => !have.has(m.name.toLowerCase().replace(/\s/g, '')))
        .map((m) => ({ ...m, cat: catFor(m.kind) }))
        .filter((m) => m.cat);
      if (add.length) {
        await prisma.menuItem.createMany({
          data: add.map((m) => ({
            businessId,
            name: m.name,
            nameAm: m.nameAm,
            priceEtb: m.priceEtb,
            category: m.kind,
            categoryId: m.cat!.id,
          })),
        });
        say(`  menu: added ${add.length} items`);
      }
      menu = await prisma.menuItem.findMany({
        where: { businessId, active: true, deletedAt: null },
      });
    }
    if (menu.length === 0) {
      console.error('The business has no menu items.');
      process.exit(1);
    }
    // A few dishes sell much more (clear top sellers).
    const popular = [...menu].sort(() => Math.random() - 0.5).slice(0, 3);
    const pickItem = () => (chance(0.45) ? pick(popular) : pick(menu));

    const tables = await prisma.restaurantTable.findMany({ where: { businessId } });
    const areas = await prisma.deliveryArea.findMany({ where: { businessId } });
    const bank = await prisma.bankAccount.findFirst({ where: { businessId } });
    const bankCode = bank?.bankCode ?? 'CBE';

    // ── Build every row in memory, then save in a few createMany calls ──
    const { at, hourNow } = addisClock();
    const bills: Prisma.BillCreateManyInput[] = [];
    const orders: Prisma.OrderCreateManyInput[] = [];
    const items: Prisma.OrderItemCreateManyInput[] = [];
    const kitchen: Prisma.KitchenOrderCreateManyInput[] = [];
    const scans: Prisma.BillPaymentScanCreateManyInput[] = [];
    const payments: Prisma.PaymentCreateManyInput[] = [];
    const tips: Prisma.TipCreateManyInput[] = [];
    const checks: Prisma.ReceiptCheckCreateManyInput[] = [];
    const spendings: Prisma.SpendingCreateManyInput[] = [];
    const buyItems: Prisma.BuyItemCreateManyInput[] = [];

    let orderCount = 0;

    /** One bill with 1–2 orders; paid (with payment and maybe a tip) unless `open`. */
    function addBill(daysAgo: number, createdAt: Date, open = false, tableId?: string) {
      const waiter = pick(waiters);
      const type: BillType = tableId
        ? 'dine'
        : chance(0.68) && tables.length
          ? 'dine'
          : chance(0.6) || !areas.length
            ? 'takeaway'
            : 'delivery';
      const billId = id();
      let foodTotal = 0;
      let allCancelled = true;
      const orderTimes = chance(0.25) ? 2 : 1;
      for (let o = 0; o < orderTimes; o++) {
        const orderId = id();
        const orderAt = new Date(createdAt.getTime() + o * rand(10, 30) * 60_000);
        const lines = Array.from({ length: rand(1, 4) }, () => pickItem());
        let orderTotal = 0;
        for (const it of lines) {
          const quantity = chance(0.75) ? 1 : rand(2, 3);
          orderTotal += it.priceEtb * quantity;
          items.push({
            id: id(),
            orderId,
            menuItemId: it.id,
            name: it.name,
            priceEtb: it.priceEtb,
            quantity,
          });
        }
        const cancelled = !open && chance(0.03);
        if (!cancelled) {
          foodTotal += orderTotal;
          allCancelled = false;
        }
        orders.push({
          id: orderId,
          businessId,
          billId,
          number: 0, // set below, in time order
          waiterId: waiter.id,
          foodTotalEtb: orderTotal,
          createdAt: orderAt,
          ...(cancelled && {
            cancelledAt: new Date(orderAt.getTime() + 3 * 60_000),
            cancelReason: pick(CANCEL_REASONS),
            cancelledById: waiter.id,
          }),
        });
        orderCount++;
        if (!cancelled) {
          const minutes = rand(8, 28);
          kitchen.push({
            id: id(),
            businessId,
            orderId,
            status: open && chance(0.5) ? 'cooking' : 'ready',
            startedAt: new Date(orderAt.getTime() + 2 * 60_000),
            readyAt: open ? null : new Date(orderAt.getTime() + minutes * 60_000),
            createdAt: orderAt,
          });
        }
      }

      const packing = type === 'dine' ? 0 : 20;
      const area = type === 'delivery' ? pick(areas) : null;
      const delivery = area ? area.usualFeeEtb : 0;
      const total = allCancelled ? 0 : foodTotal + packing + delivery;
      const paidAt = new Date(createdAt.getTime() + rand(25, 70) * 60_000);
      bills.push({
        id: billId,
        businessId,
        type,
        tableId: type === 'dine' ? (tableId ?? pick(tables).id) : null,
        guests: type === 'dine' ? rand(1, 5) : null,
        customerName: type === 'dine' ? null : pick(['Selam', 'Abel', 'Ruth', 'Natnael', 'Meron']),
        customerPhone: type === 'dine' ? null : `09${rand(10000000, 99999999)}`,
        deliveryAreaId: area?.id ?? null,
        address: area ? `${area.name}, near the school` : null,
        usualDeliveryFeeEtb: area?.usualFeeEtb ?? null,
        foodTotalEtb: allCancelled ? 0 : foodTotal,
        packingFeeEtb: allCancelled ? 0 : packing,
        deliveryFeeEtb: allCancelled ? 0 : delivery,
        totalEtb: total,
        waiterId: waiter.id,
        status: allCancelled ? 'cancelled' : open ? 'open' : 'paid',
        servedStatus: open ? 'kitchen' : 'served',
        paidAt: open || allCancelled ? null : paidAt,
        createdAt,
        updatedAt: open ? createdAt : paidAt,
      });
      if (open || allCancelled) return;

      // ── Payment: cash, bank or cash+bank; sometimes a tip ──
      const r = Math.random();
      const method: PaymentMethod = r < 0.4 ? 'cash' : r < 0.85 ? 'bank' : 'cash_bank';
      const tip = chance(0.35) ? round10(rand(10, Math.max(20, Math.min(150, total * 0.1)))) : 0;
      const cash = method === 'cash' ? total : method === 'cash_bank' ? round10(total * 0.4) : 0;
      const bankPart = method === 'cash' ? 0 : total - cash + tip;
      const paymentId = id();
      payments.push({
        id: paymentId,
        businessId,
        billId,
        method,
        cashEtb: method === 'cash' ? total + tip : cash,
        bankEtb: bankPart,
        tipEtb: tip,
        recordedById: waiter.id,
        idempotencyKey: `${MARK}-${paymentId}`,
        createdAt: paidAt,
      });
      if (method !== 'cash') {
        bills[bills.length - 1]!.bankReceivedEtb = bankPart;
        scans.push({
          id: id(),
          businessId,
          billId,
          memberId: waiter.id,
          amountEtb: bankPart,
          cashEtb: cash,
          reference: `FT${rand(10000000, 99999999)}${rand(1000, 9999)}`,
          idempotencyKey: `${MARK}-${id()}`,
          createdAt: paidAt,
        });
      }
      if (tip > 0) {
        // Older tips were paid out at the end of their day; today's are still to pay.
        const paidOut = daysAgo > 0 && chance(0.9);
        tips.push({
          id: id(),
          businessId,
          billId,
          paymentId,
          amountEtb: tip,
          source: method === 'cash' ? 'cash' : 'bank',
          waiterId: waiter.id,
          paidOut,
          paidOutAt: paidOut ? at(daysAgo, 22, rand(0, 50)) : null,
          createdAt: paidAt,
        });
      }
      // Now and then a receipt that did not check out before the right one.
      if (method !== 'cash' && chance(0.06)) {
        const f = pick(FAIL_REASONS);
        checks.push({
          id: id(),
          businessId,
          checkedById: waiter.id,
          billId,
          bankCode,
          status: f.status,
          reasons: f.reasons,
          reference: f.status === 'not_matching' ? `FT${rand(10000000, 99999999)}` : null,
          receiptAmountEtb: f.reasons[0] === 'AMOUNT_TOO_LOW' ? Math.max(1, total - 100) : null,
          expectedAmountEtb: total,
          createdAt: new Date(paidAt.getTime() - 4 * 60_000),
        });
      }
    }

    for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
      const weekday = at(daysAgo, 12, 0).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      const lastHour = daysAgo === 0 ? Math.max(8, hourNow) : 21;
      const count = daysAgo === 0 ? rand(18, 26) : weekend ? rand(30, 45) : rand(18, 32);
      for (let i = 0; i < count; i++) {
        addBill(daysAgo, at(daysAgo, busyHour(lastHour), rand(0, 59)));
      }

      // Money out: 1–3 a day, from the owner or a manager.
      for (let s = 0; s < rand(1, 3); s++) {
        const sp = pick(SPENDINGS);
        spendings.push({
          id: id(),
          businessId,
          title: sp.title,
          amount: round10(rand(sp.min, sp.max)),
          category: sp.category,
          paidFrom: (chance(0.6) ? 'CASH' : 'BANK') as PaidFrom,
          createdById: pick(managers).id,
          createdAt: at(daysAgo, rand(8, Math.max(8, lastHour)), rand(0, 59)),
          hasReceipt: chance(0.85),
          forBusiness: chance(0.95),
          reviewedAt: daysAgo > 1 ? at(daysAgo, 22, 0) : null,
        });
      }
    }

    // Open tables right now (only tables without an open bill).
    const busy = new Set(
      (
        await prisma.bill.findMany({
          where: { businessId, status: 'open', type: 'dine' },
          select: { tableId: true },
        })
      ).map((b) => b.tableId)
    );
    const free = tables.filter((t) => !busy.has(t.id)).slice(0, 3);
    for (const table of free) {
      addBill(0, at(0, Math.max(8, hourNow), rand(0, 30)), true, table.id);
    }

    // Buy list: some bought (each with its spending), some still to buy.
    for (const [n, b] of BUY_LIST.entries()) {
      const daysAgo = n < 2 ? rand(1, 6) : 0;
      const bought = n < 2;
      const buyId = id();
      const createdAt = at(daysAgo, 8, rand(30, 59));
      const price = round10(rand(150, 2000));
      const paidFrom: PaidFrom = chance(0.6) ? 'CASH' : 'BANK';
      buyItems.push({
        id: buyId,
        businessId,
        name: b.name,
        qty: b.qty,
        when: n % 2 ? 'WEEK' : 'TODAY',
        status: bought ? 'BOUGHT' : 'OPEN',
        createdById: kitchenPerson.id,
        boughtById: bought ? owner.id : null,
        price: bought ? price : null,
        paidFrom: bought ? paidFrom : null,
        createdAt,
        boughtAt: bought ? new Date(createdAt.getTime() + 3 * 3_600_000) : null,
      });
      if (bought) {
        spendings.push({
          id: id(),
          businessId,
          title: `${b.name} · ${b.qty}`,
          amount: price,
          category: 'FOOD',
          paidFrom,
          buyItemId: buyId,
          createdById: owner.id,
          createdAt: new Date(createdAt.getTime() + 3 * 3_600_000),
        });
      }
    }

    // Order numbers in time order, from the business counter.
    const { nextOrderNumber } = await prisma.business.update({
      where: { id: businessId },
      data: { nextOrderNumber: { increment: orderCount } },
      select: { nextOrderNumber: true },
    });
    let number = nextOrderNumber - orderCount;
    const sorted = [...orders].sort(
      (a, b) => new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime()
    );
    for (const o of sorted) o.number = number++;

    const chunk = async <T>(rows: T[], save: (part: T[]) => Promise<unknown>) => {
      for (let i = 0; i < rows.length; i += 500) await save(rows.slice(i, i + 500));
    };
    await chunk(bills, (data) => prisma.bill.createMany({ data }));
    await chunk(orders, (data) => prisma.order.createMany({ data }));
    await chunk(items, (data) => prisma.orderItem.createMany({ data }));
    await chunk(kitchen, (data) => prisma.kitchenOrder.createMany({ data }));
    await chunk(payments, (data) => prisma.payment.createMany({ data }));
    await chunk(scans, (data) => prisma.billPaymentScan.createMany({ data }));
    await chunk(tips, (data) => prisma.tip.createMany({ data }));
    await chunk(checks, (data) => prisma.receiptCheck.createMany({ data }));
    await chunk(buyItems, (data) => prisma.buyItem.createMany({ data }));
    await chunk(spendings, (data) => prisma.spending.createMany({ data }));

    const sales = payments.reduce(
      (s, p) => s + (p.cashEtb ?? 0) + (p.bankEtb ?? 0) - (p.tipEtb ?? 0),
      0
    );
    say(`\n${business.name}: demo activity for the last ${DAYS} days`);
    say(`  bills ${bills.length} (open now ${free.length}), orders ${orders.length}`);
    say(
      `  sales ${sales.toLocaleString('en-US')} ETB, tips ${tips.length} for ${waiters.length} waiters`
    );
    say(
      `  failed checks ${checks.length}, spendings ${spendings.length}, buy list ${buyItems.length}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
