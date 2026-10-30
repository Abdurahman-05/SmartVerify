import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { recordCheck } from '../modules/verification/record-check.js';
import type { VerifyResponse } from '../modules/verification/verification.schemas.js';
import { sendScheduledNotifications } from '../services/notifications.js';
import { pushText } from '../services/push.js';
import {
  createRestaurant,
  createTestApp,
  headers,
  newKey,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDatabase(app);
  r = await createRestaurant(app);
});

interface Inbox {
  unread: number;
  items: { id: string; type: string; data: Record<string, unknown>; read: boolean }[];
}
const inbox = async (token: string) =>
  (
    await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: headers(token) })
  ).json() as Inbox;

const verified = (amountEtb: number, reference: string): VerifyResponse =>
  ({
    status: 'verified',
    reference,
    amountEtb,
    extraEtb: 0,
    payerName: 'Kebede Alemu',
    receiverName: 'Test Cafe',
    date: new Date().toISOString(),
  }) as VerifyResponse;

describe('notifications', () => {
  it('a new order tells the chef; ready tells the waiter who took it', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token, newKey()),
      payload: {
        type: 'dine',
        tableId: r.tables[1]!.id,
        items: [{ menuItemId: r.menu.tibs.id, quantity: 2 }],
      },
    });
    const chef = await inbox(r.chef.token);
    expect(chef.unread).toBe(1);
    expect(chef.items[0]).toMatchObject({
      type: 'new_order',
      data: { type: 'dine', table: 2, items: 1 },
    });
    expect((await inbox(r.waiter2.token)).unread).toBe(0);

    const [ticket] = (
      await app.inject({
        method: 'GET',
        url: '/api/v1/kitchen/orders',
        headers: headers(r.chef.token),
      })
    ).json() as { id: string }[];
    await app.inject({
      method: 'POST',
      url: `/api/v1/kitchen/orders/${ticket!.id}/ready`,
      headers: headers(r.chef.token),
    });
    expect((await inbox(r.waiter.token)).items[0]).toMatchObject({
      type: 'order_ready',
      data: { table: 2 },
    });
    expect((await inbox(r.waiter2.token)).unread).toBe(0);

    // Reading: one by id, then all.
    const id = chef.items[0]!.id;
    await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read',
      headers: headers(r.chef.token),
      payload: { ids: [id] },
    });
    expect(await inbox(r.chef.token)).toMatchObject({ unread: 0, items: [{ read: true }] });
  });

  it('big payments and a receipt used twice tell the owner and managers', async () => {
    const base = { businessId: r.businessId, memberId: r.waiter.memberId, bankCode: 'CBE' };
    await recordCheck(app.prisma, {
      ...base,
      expectedAmountEtb: 100,
      result: verified(100, 'FT1'),
    });
    expect((await inbox(r.owner.token)).unread).toBe(0);

    await recordCheck(app.prisma, {
      ...base,
      expectedAmountEtb: 6000,
      result: verified(6000, 'FT2'),
    });
    await recordCheck(app.prisma, {
      ...base,
      expectedAmountEtb: 100,
      result: verified(100, 'FT1'),
    });
    const owner = await inbox(r.owner.token);
    expect(owner.items.map((n) => n.type)).toEqual(['bad_receipt', 'big_payment']);
    expect(owner.items[0]!.data).toMatchObject({
      reasons: ['DUPLICATE'],
      checkedBy: 'Waiter Dawit',
    });
    expect((await inbox(r.manager.token)).unread).toBe(2);
    expect((await inbox(r.waiter.token)).unread).toBe(0);
  });

  it('the evening summary and plan reminders are sent once', async () => {
    const base = { businessId: r.businessId, memberId: r.waiter.memberId, bankCode: 'CBE' };
    await recordCheck(app.prisma, {
      ...base,
      expectedAmountEtb: 250,
      result: verified(250, 'FT9'),
    });
    // 21:30 in Addis Ababa today (or now, if that has passed): the summary hour.
    const now = new Date();
    const addisDay = new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
    const evening = new Date(`${addisDay}T21:30:00+03:00`);
    const at = evening < now ? now : evening;
    // A paid plan ending in 3 days.
    await app.prisma.subscription.create({
      data: {
        businessId: r.businessId,
        plan: 'restaurant',
        period: 'monthly',
        priceEtb: 4000,
        startedAt: now,
        endsAt: new Date(at.getTime() + 2.5 * 86_400_000),
        paymentMethod: 'cbe',
      },
    });
    await sendScheduledNotifications(app.prisma, undefined, at);
    await sendScheduledNotifications(app.prisma, undefined, at);

    const owner = await inbox(r.owner.token);
    const types = owner.items.map((n) => n.type).sort();
    expect(types).toEqual(['daily_summary', 'plan_ending']);
    expect(owner.items.find((n) => n.type === 'daily_summary')!.data).toMatchObject({
      count: 1,
      totalEtb: 250,
    });
    expect(owner.items.find((n) => n.type === 'plan_ending')!.data).toMatchObject({ daysLeft: 3 });
    // Managers get the summary, not the plan reminder.
    expect((await inbox(r.manager.token)).items.map((n) => n.type)).toEqual(['daily_summary']);
  });
});

describe('push notifications', () => {
  it('a phone registers its push token; it moves to whoever signs in last on it', async () => {
    const token = 'ExponentPushToken[abc-123]';
    const put = (who: string, body: object) =>
      app.inject({
        method: 'PUT',
        url: '/api/v1/notifications/push-token',
        headers: headers(who),
        payload: body,
      });
    expect((await put(r.chef.token, { token, language: 'am' })).statusCode).toBe(204);
    expect((await put(r.waiter.token, { token })).statusCode).toBe(204);
    const rows = await app.prisma.pushToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ memberId: r.waiter.memberId, language: 'en' });
    expect((await put(r.waiter.token, { token: 'not-a-token' })).statusCode).toBe(400);
  });

  it('lock-screen text in English and Amharic', () => {
    const order = { orderNo: 1002, type: 'dine', table: 2, items: 2 };
    expect(pushText('new_order', order, 'en')).toEqual({
      title: 'New order · Table 2',
      body: '2 item(s) · order #1002',
    });
    expect(pushText('order_ready', order, 'am')?.title).toBe('ምግብ ተዘጋጅቷል · ጠረጴዛ 2');
    expect(
      pushText('big_payment', { amountEtb: 6500, payerName: 'Kebede', bankCode: 'CBE' }, 'en')
    ).toMatchObject({ title: 'Big payment: 6,500 ETB' });
    expect(pushText('something_else', {}, 'en')).toBeNull();
  });
});
