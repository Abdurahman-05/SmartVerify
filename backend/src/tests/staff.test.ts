import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createRestaurant,
  createTestApp,
  headers,
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

interface Member {
  id: string;
  name: string;
  phone: string;
  role: string;
  active: boolean;
  canChangeDeliveryFee: boolean;
  canSeeReports: boolean;
  pinIsTemporary: boolean;
  editable: boolean;
}

const call = (method: 'GET' | 'POST' | 'PATCH', url: string, token: string | null, body?: object) =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    headers: token ? headers(token) : undefined,
    payload: body,
  });
const code = (res: { json: () => unknown }) =>
  (res.json() as { error?: { code?: string } }).error?.code;
const list = async (token: string) => (await call('GET', '/staff', token)).json() as Member[];
const signIn = (phone: string, pin: string) => call('POST', '/auth/sign-in', null, { phone, pin });

let phoneCounter = 0;
const newPhone = () => `79${String(1_000_000 + ++phoneCounter).padStart(7, '0')}`;

const addWaiter = async (token = r.owner.token, extra: object = {}) => {
  const phone = newPhone();
  const res = await call('POST', '/staff', token, {
    name: 'Kebede Alemu',
    phone,
    pin: '4321',
    role: 'waiter',
    ...extra,
  });
  return { res, phone, member: res.json() as Member };
};

describe('staff', () => {
  it('owner and manager see the team without the owner; waiters and chefs are refused', async () => {
    const forOwner = await list(r.owner.token);
    expect(forOwner.map((m) => m.name).sort()).toEqual([
      'Chef Hana',
      'Manager Yonas',
      'Waiter Dawit',
      'Waiter Fee',
      'Waiter Selam',
    ]);
    // The owner can change everyone; a manager cannot change themselves or other managers.
    expect(forOwner.every((m) => m.editable)).toBe(true);
    const forManager = await list(r.manager.token);
    expect(forManager.find((m) => m.name === 'Manager Yonas')?.editable).toBe(false);
    expect(forManager.find((m) => m.name === 'Waiter Dawit')?.editable).toBe(true);

    for (const token of [r.waiter.token, r.chef.token]) {
      expect((await call('GET', '/staff', token)).statusCode).toBe(403);
    }
    // No PIN or hash is ever in the answer.
    expect(JSON.stringify(forOwner)).not.toMatch(/pinHash|"pin"/);
  });

  it('adds a person with a temporary PIN; they sign in and must choose their own', async () => {
    const { res, phone, member } = await addWaiter(r.owner.token, { canSeeReports: true });
    expect(res.statusCode).toBe(201);
    expect(member).toMatchObject({
      name: 'Kebede Alemu',
      phone,
      role: 'waiter',
      active: true,
      canSeeReports: true,
      pinIsTemporary: true,
    });

    const signedIn = await signIn(phone, '4321');
    expect(signedIn.statusCode).toBe(200);
    const { token, user } = signedIn.json() as { token: string; user: { pinIsTemporary: boolean } };
    expect(user.pinIsTemporary).toBe(true);

    // Choosing their own PIN clears the flag.
    const change = await call('POST', '/auth/change-pin', token, {
      currentPin: '4321',
      newPin: '8765',
    });
    expect(change.statusCode).toBe(204);
    const again = (await signIn(phone, '8765')).json() as { user: { pinIsTemporary: boolean } };
    expect(again.user.pinIsTemporary).toBe(false);
    expect((await list(r.owner.token)).find((m) => m.phone === phone)?.pinIsTemporary).toBe(false);
  });

  it('adding a taken phone is refused; a retried add returns the same person', async () => {
    const { phone } = await addWaiter();
    const body = { name: 'Other Person', phone, pin: '1111', role: 'chef' };
    expect(code(await call('POST', '/staff', r.owner.token, body))).toBe('PHONE_TAKEN');

    // Same request again (the answer was lost): the first member comes back, nothing doubles.
    const retry = await call('POST', '/staff', r.owner.token, {
      name: 'Kebede Alemu',
      phone,
      pin: '4321',
      role: 'waiter',
    });
    expect(retry.statusCode).toBe(201);
    expect((await list(r.owner.token)).filter((m) => m.phone === phone)).toHaveLength(1);
  });

  it('only the owner adds managers; bad input is refused', async () => {
    const asManager = await addWaiter(r.manager.token, { role: 'manager', phone: newPhone() });
    expect(asManager.res.statusCode).toBe(403);
    const asOwner = await addWaiter(r.owner.token, { role: 'manager' });
    expect(asOwner.res.statusCode).toBe(201);

    for (const bad of [
      { pin: '123' },
      { pin: '12345' },
      { phone: '12345' },
      { name: 'A' },
      { role: 'owner' },
    ]) {
      expect((await addWaiter(r.owner.token, bad)).res.statusCode).toBe(400);
    }
    for (const token of [r.waiter.token, r.chef.token]) {
      expect((await addWaiter(token)).res.statusCode).toBe(403);
    }
  });

  it('edits name, role and permissions with the role rules', async () => {
    const { member } = await addWaiter();
    const edited = await call('PATCH', `/staff/${member.id}`, r.manager.token, {
      name: 'Kebede A.',
      canChangeDeliveryFee: true,
    });
    expect(edited.json()).toMatchObject({ name: 'Kebede A.', canChangeDeliveryFee: true });

    // A manager cannot make a manager, change a manager, change themselves, or reach the owner.
    expect(
      (await call('PATCH', `/staff/${member.id}`, r.manager.token, { role: 'manager' })).statusCode
    ).toBe(403);
    expect(
      (await call('PATCH', `/staff/${r.manager.memberId}`, r.manager.token, { name: 'Me again' }))
        .statusCode
    ).toBe(403);
    expect(
      (await call('PATCH', `/staff/${r.owner.memberId}`, r.manager.token, { active: false }))
        .statusCode
    ).toBe(403);
    // The owner can promote.
    const promoted = await call('PATCH', `/staff/${member.id}`, r.owner.token, { role: 'manager' });
    expect(promoted.json()).toMatchObject({ role: 'manager' });
    expect(
      (await call('PATCH', `/staff/${member.id}`, r.manager.token, { name: 'Now a manager' }))
        .statusCode
    ).toBe(403);
    // The owner cannot change themselves here either.
    expect(
      (await call('PATCH', `/staff/${r.owner.memberId}`, r.owner.token, { active: false }))
        .statusCode
    ).toBe(403);

    expect((await call('PATCH', `/staff/${member.id}`, r.owner.token, {})).statusCode).toBe(400);
    expect((await call('PATCH', '/staff/nope', r.owner.token, { name: 'Nobody' })).statusCode).toBe(
      404
    );
  });

  it('turning someone off signs them out at once; turning them on lets them back in', async () => {
    const { phone, member } = await addWaiter();
    const { token } = (await signIn(phone, '4321')).json() as { token: string };
    expect((await call('GET', '/auth/me', token)).statusCode).toBe(200);

    const off = await call('PATCH', `/staff/${member.id}`, r.manager.token, { active: false });
    expect(off.json()).toMatchObject({ active: false });
    expect((await call('GET', '/auth/me', token)).statusCode).toBe(401);
    expect(code(await signIn(phone, '4321'))).toBe('WRONG_CREDENTIALS');

    await call('PATCH', `/staff/${member.id}`, r.manager.token, { active: true });
    expect((await signIn(phone, '4321')).statusCode).toBe(200);
    // Inactive people are listed after active ones.
    await call('PATCH', `/staff/${r.waiter.memberId}`, r.owner.token, { active: false });
    const order = (await list(r.owner.token)).map((m) => m.active);
    expect(order).toEqual([...order].sort((a, b) => Number(b) - Number(a)));
  });

  it('resets a forgotten PIN: old PIN and sessions stop, the new temporary PIN works once', async () => {
    const { phone, member } = await addWaiter();
    const first = (await signIn(phone, '4321')).json() as { token: string };
    await call('POST', '/auth/change-pin', first.token, { currentPin: '4321', newPin: '5555' });
    const second = (await signIn(phone, '5555')).json() as {
      token: string;
      user: { pinIsTemporary: boolean };
    };
    expect(second.user.pinIsTemporary).toBe(false);

    const reset = await call('POST', `/staff/${member.id}/reset-pin`, r.manager.token, {
      pin: '9090',
    });
    expect(reset.statusCode).toBe(204);
    expect(reset.body).toBe('');

    expect((await call('GET', '/auth/me', second.token)).statusCode).toBe(401);
    expect(code(await signIn(phone, '5555'))).toBe('WRONG_CREDENTIALS');
    const back = (await signIn(phone, '9090')).json() as { user: { pinIsTemporary: boolean } };
    expect(back.user.pinIsTemporary).toBe(true);
  });

  it('PIN resets follow the role rules and validate the PIN', async () => {
    const { member } = await addWaiter();
    for (const pin of ['123', '12345', 'abcd']) {
      expect(
        (await call('POST', `/staff/${member.id}/reset-pin`, r.owner.token, { pin })).statusCode
      ).toBe(400);
    }
    expect(
      (
        await call('POST', `/staff/${r.manager.memberId}/reset-pin`, r.manager.token, {
          pin: '1234',
        })
      ).statusCode
    ).toBe(403);
    expect(
      (await call('POST', `/staff/${r.owner.memberId}/reset-pin`, r.manager.token, { pin: '1234' }))
        .statusCode
    ).toBe(403);
    // The owner can reset a manager; waiters and chefs cannot reset anyone.
    expect(
      (await call('POST', `/staff/${r.manager.memberId}/reset-pin`, r.owner.token, { pin: '1234' }))
        .statusCode
    ).toBe(204);
    for (const token of [r.waiter.token, r.chef.token]) {
      expect(
        (await call('POST', `/staff/${member.id}/reset-pin`, token, { pin: '1234' })).statusCode
      ).toBe(403);
    }
    expect(
      (await call('POST', '/staff/nope/reset-pin', r.owner.token, { pin: '1234' })).statusCode
    ).toBe(404);
  });

  it('cannot reach another business’s people', async () => {
    const other = await createRestaurant(app);
    const theirs = (await list(other.owner.token))[0]!;
    expect((await list(r.owner.token)).some((m) => m.id === theirs.id)).toBe(false);
    expect(
      (await call('PATCH', `/staff/${theirs.id}`, r.owner.token, { name: 'Taken over' })).statusCode
    ).toBe(404);
    expect(
      (await call('POST', `/staff/${theirs.id}/reset-pin`, r.owner.token, { pin: '1234' }))
        .statusCode
    ).toBe(404);
  });
});

describe('staff on the Normal plans', () => {
  it('only workers (the waiter role) can be added or made', async () => {
    // Room for new workers: the restaurant's staff are turned off.
    await app.prisma.businessMember.updateMany({
      where: { businessId: r.businessId, role: { not: 'owner' } },
      data: { active: false },
    });
    for (const plan of ['normal', 'normal_multi'] as const) {
      await app.prisma.business.update({ where: { id: r.businessId }, data: { plan } });
      const body = { name: 'Almaz Worku', pin: '4321', role: 'manager' };
      const refused = await call('POST', '/staff', r.owner.token, { ...body, phone: newPhone() });
      expect(refused.json(), plan).toMatchObject({
        error: { code: 'VALIDATION_ERROR', details: { reason: 'workerOnly' } },
      });
      const worker = await call('POST', '/staff', r.owner.token, {
        ...body,
        role: 'waiter',
        phone: newPhone(),
      });
      expect(worker.statusCode, plan).toBe(201);
      const id = worker.json<Member>().id;
      expect(
        (await call('PATCH', `/staff/${id}`, r.owner.token, { role: 'chef' })).statusCode
      ).toBe(400);
    }
  });
});

describe('how many workers', () => {
  it('Normal: the owner and 2 active workers; Normal Multi: no limit', async () => {
    await app.prisma.businessMember.updateMany({
      where: { businessId: r.businessId, role: { not: 'owner' } },
      data: { active: false },
    });
    await app.prisma.business.update({ where: { id: r.businessId }, data: { plan: 'normal' } });
    const add = () =>
      call('POST', '/staff', r.owner.token, {
        name: 'Branch 1 Worker',
        phone: newPhone(),
        pin: '4321',
        role: 'waiter',
      });
    expect((await add()).statusCode).toBe(201);
    const second = await add();
    expect(second.statusCode).toBe(201);
    const third = await add();
    expect(third.json()).toMatchObject({ error: { code: 'STAFF_LIMIT', details: { limit: 2 } } });

    // Turning one off makes room; turning it back on while full is refused.
    const id = second.json<Member>().id;
    await call('PATCH', `/staff/${id}`, r.owner.token, { active: false });
    expect((await add()).statusCode).toBe(201);
    const back = await call('PATCH', `/staff/${id}`, r.owner.token, { active: true });
    expect(back.json()).toMatchObject({ error: { code: 'STAFF_LIMIT' } });

    await app.prisma.business.update({
      where: { id: r.businessId },
      data: { plan: 'normal_multi' },
    });
    expect((await add()).statusCode).toBe(201);
    expect((await call('PATCH', `/staff/${id}`, r.owner.token, { active: true })).statusCode).toBe(
      200
    );
  });
});

describe('Normal Verify in the Restaurant app (restaurant_normal)', () => {
  it('waiters only, any number of them', async () => {
    await app.prisma.businessMember.updateMany({
      where: { businessId: r.businessId, role: { not: 'owner' } },
      data: { active: false },
    });
    await app.prisma.business.update({
      where: { id: r.businessId },
      data: { plan: 'restaurant_normal' },
    });
    for (let i = 0; i < 3; i += 1) {
      const res = await call('POST', '/staff', r.owner.token, {
        name: 'Waiter Many',
        phone: newPhone(),
        pin: '4321',
        role: 'waiter',
      });
      expect(res.statusCode).toBe(201);
    }
    const chef = await call('POST', '/staff', r.owner.token, {
      name: 'Chef No',
      phone: newPhone(),
      pin: '4321',
      role: 'chef',
    });
    expect(chef.statusCode).toBe(400);
  });
});
