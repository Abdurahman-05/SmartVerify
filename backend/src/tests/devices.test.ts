import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Plan } from '../generated/prisma/client.js';
import { hashPin } from '../services/pin-hasher.js';
import { createTestApp, headers, resetDatabase, type TestApp } from './helpers.js';

let app: TestApp;
let phone = 911000100;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDatabase(app);
});

/** A business with the given plan: the owner (PIN 123456) and two workers (PIN 1234). */
async function shop(plan: Plan) {
  const make = async (pin: string) => {
    phone += 1;
    const user = await app.prisma.user.create({
      data: { name: `Person ${phone}`, phone: String(phone), pinHash: await hashPin(pin) },
    });
    return user;
  };
  const owner = await make('123456');
  const business = await app.prisma.business.create({
    data: { name: 'Shop', ownerId: owner.id, plan },
  });
  await app.prisma.businessMember.create({
    data: { businessId: business.id, userId: owner.id, role: 'owner' },
  });
  const workers = [];
  for (let i = 0; i < 2; i += 1) {
    const user = await make('1234');
    await app.prisma.businessMember.create({
      data: { businessId: business.id, userId: user.id, role: 'waiter' },
    });
    workers.push(user);
  }
  return { owner, workers };
}

const signIn = (phoneNumber: string, pin: string) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-in',
    payload: { phone: phoneNumber, pin },
  });

describe('devices signed in at a time', () => {
  it('Normal: 2 devices; a third worker is refused, the owner signs out the oldest', async () => {
    const { owner, workers } = await shop('normal');
    const [w1, w2] = workers;
    const first = await signIn(w1!.phone, '1234');
    expect(first.statusCode).toBe(200);
    expect((await signIn(w2!.phone, '1234')).statusCode).toBe(200);

    // The same worker on a new phone replaces their own older device.
    const again = await signIn(w2!.phone, '1234');
    expect(again.statusCode).toBe(200);

    // Both seats are taken by other people: a worker is refused.
    await app.prisma.session.updateMany({ data: { revokedAt: null } });
    await app.prisma.session.deleteMany({ where: { userId: w2!.id } });
    expect((await signIn(w2!.phone, '1234')).statusCode).toBe(200);
    const owners = await signIn(owner.phone, '123456');
    expect(owners.statusCode).toBe(200);
    // The owner took the oldest seat: worker 1 is signed out.
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: headers(first.json<{ token: string }>().token),
    });
    expect(me.statusCode).toBe(401);
    const refused = await signIn(w1!.phone, '1234');
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({
      error: { code: 'DEVICE_LIMIT', details: { limit: 2 } },
    });
  });

  it('Normal Multi and Restaurant Plus: no device limit', async () => {
    for (const plan of ['normal_multi', 'restaurant'] as const) {
      await resetDatabase(app);
      const { owner, workers } = await shop(plan);
      for (const user of [owner, ...workers]) {
        const pin = user.id === owner.id ? '123456' : '1234';
        expect((await signIn(user.phone, pin)).statusCode, plan).toBe(200);
      }
    }
  });
});
