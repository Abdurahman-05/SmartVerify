import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addStaff,
  bearer,
  createTestApp,
  registerOwner,
  resetDatabase,
  signIn,
  type TestApp,
} from './helpers.js';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDatabase(app);
});

describe('staff', () => {
  it('owner adds a waiter; the PIN is never returned and staff share the owner plan', async () => {
    const owner = await registerOwner(app);
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/business/plan',
      headers: bearer(owner.token),
      payload: { plan: 'restaurant' },
    });

    const { res, payload } = await addStaff(app, owner.token, { role: 'waiter', pin: '4321' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ role: 'waiter', active: true, phone: payload.phone });
    expect(res.json()).not.toHaveProperty('pin');
    expect(res.body).not.toContain('4321');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/staff',
      headers: bearer(owner.token),
    });
    expect(list.body).not.toContain('4321');
    expect(list.body).not.toMatch(/pinHash|\$argon2/);

    const login = await signIn(app, payload.phone, '4321');
    expect(login.statusCode).toBe(200);
    expect(login.json().user).toMatchObject({
      role: 'waiter',
      plan: 'restaurant',
      businessName: 'Test Cafe',
    });
  });

  it('inactive staff cannot sign in, and deactivation ends their sessions', async () => {
    const owner = await registerOwner(app);
    const { res, payload } = await addStaff(app, owner.token, { role: 'chef', pin: '5555' });
    const staffId = res.json().id;
    const session = await signIn(app, payload.phone, '5555');
    const staffToken = session.json().token;

    const off = await app.inject({
      method: 'PATCH',
      url: `/api/v1/staff/${staffId}`,
      headers: bearer(owner.token),
      payload: { active: false },
    });
    expect(off.json().active).toBe(false);

    const again = await signIn(app, payload.phone, '5555');
    expect(again.statusCode).toBe(401);
    expect(again.json()).toEqual({ error: { code: 'WRONG_CREDENTIALS' } });

    const oldToken = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearer(staffToken),
    });
    expect(oldToken.statusCode).toBe(401);
  });

  it('phone numbers are unique, including the owner phone', async () => {
    const owner = await registerOwner(app);
    const { res } = await addStaff(app, owner.token, { role: 'waiter', phone: owner.phone });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'PHONE_TAKEN' } });
  });

  it('only the owner can add a manager; managers can add waiters and chefs', async () => {
    const owner = await registerOwner(app);
    const { payload: mgr } = await addStaff(app, owner.token, { role: 'manager', pin: '2222' });
    const managerToken = (await signIn(app, mgr.phone, '2222')).json().token;

    const addManager = await addStaff(app, managerToken, { role: 'manager' });
    expect(addManager.res.statusCode).toBe(403);
    expect(addManager.res.json()).toEqual({ error: { code: 'FORBIDDEN' } });

    const addWaiter = await addStaff(app, managerToken, { role: 'waiter' });
    expect(addWaiter.res.statusCode).toBe(201);
  });

  it('waiters cannot manage staff and nobody can deactivate themselves', async () => {
    const owner = await registerOwner(app);
    const { res, payload } = await addStaff(app, owner.token, { role: 'manager', pin: '3333' });
    const managerToken = (await signIn(app, payload.phone, '3333')).json().token;
    const { payload: waiter } = await addStaff(app, owner.token, { role: 'waiter', pin: '1111' });
    const waiterToken = (await signIn(app, waiter.phone, '1111')).json().token;

    const waiterList = await app.inject({
      method: 'GET',
      url: '/api/v1/staff',
      headers: bearer(waiterToken),
    });
    expect(waiterList.statusCode).toBe(403);

    const self = await app.inject({
      method: 'PATCH',
      url: `/api/v1/staff/${res.json().id}`,
      headers: bearer(managerToken),
      payload: { active: false },
    });
    expect(self.statusCode).toBe(403);
  });

  it('a business cannot see or change another business staff', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app, { businessName: 'Other Cafe' });
    const { res } = await addStaff(app, a.token, { role: 'waiter' });

    const listB = await app.inject({
      method: 'GET',
      url: '/api/v1/staff',
      headers: bearer(b.token),
    });
    expect(listB.json()).toEqual([]);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/staff/${res.json().id}`,
      headers: bearer(b.token),
      payload: { active: false },
    });
    expect(patch.statusCode).toBe(404);
  });
});
