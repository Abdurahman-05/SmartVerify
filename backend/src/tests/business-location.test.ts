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

const call = (method: 'GET' | 'PATCH', token: string, body?: object) =>
  app.inject({
    method,
    url: '/api/v1/business/location',
    headers: headers(token),
    payload: body,
  });

describe('business location', () => {
  it('is null until the owner saves one', async () => {
    const res = await call('GET', r.owner.token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });

  it('saves a valid location and returns it', async () => {
    const body = {
      lat: 9.0108,
      lng: 38.7613,
      address: 'Bole Road',
      city: 'Addis Ababa',
      area: 'Bole',
      landmark: 'Next to the Edna Mall',
    };
    const patch = await call('PATCH', r.owner.token, body);
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toEqual(body);

    const get = await call('GET', r.owner.token);
    expect(get.json()).toEqual(body);

    const saved = await app.prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(saved.latitude).toBe(9.0108);
    expect(saved.longitude).toBe(38.7613);
    expect(saved.area).toBe('Bole');
    expect(saved.locationSetAt).not.toBeNull();
  });

  it('keeps the point with only lat and lng, and clears text sent as empty', async () => {
    await call('PATCH', r.owner.token, { lat: 9, lng: 38, city: 'Addis Ababa', area: 'Bole' });
    const res = await call('PATCH', r.owner.token, { lat: 9.5, lng: 38.5, city: '' });
    expect(res.json()).toMatchObject({ lat: 9.5, lng: 38.5, city: null });
  });

  it.each([
    ['lat above 90', { lat: 90.5, lng: 38 }],
    ['lat below -90', { lat: -91, lng: 38 }],
    ['lng above 180', { lat: 9, lng: 181 }],
    ['lng below -180', { lat: 9, lng: -180.5 }],
    ['missing lng', { lat: 9 }],
    ['lat as text', { lat: 'north', lng: 38 }],
    ['text over 200 characters', { lat: 9, lng: 38, landmark: 'x'.repeat(201) }],
  ])('rejects %s', async (_name, body) => {
    const res = await call('PATCH', r.owner.token, body);
    expect(res.statusCode).toBe(400);
    const saved = await app.prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(saved.latitude).toBeNull();
  });

  it('is for the owner only', async () => {
    const body = { lat: 9, lng: 38 };
    for (const token of [r.manager.token, r.waiter.token, r.chef.token]) {
      expect((await call('PATCH', token, body)).statusCode).toBe(403);
      expect((await call('GET', token)).statusCode).toBe(403);
    }
    const saved = await app.prisma.business.findUniqueOrThrow({ where: { id: r.businessId } });
    expect(saved.latitude).toBeNull();
  });
});
