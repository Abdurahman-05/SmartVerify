import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashPassword } from '../modules/admin/admin-auth.js';
import { hashSessionToken, newSessionToken } from '../services/session-token.js';

import {
  createRestaurant,
  createTestApp,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

const DAY = 24 * 60 * 60_000;
let app: TestApp;
let r: Restaurant;
let admin = '';

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
  const user = await app.prisma.adminUser.create({
    data: {
      email: 'ops@smartverify.test',
      name: 'Ops',
      passwordHash: await hashPassword('a long test password'),
      totpEnabledAt: new Date(),
    },
  });
  admin = newSessionToken();
  await app.prisma.adminSession.create({
    data: {
      tokenHash: hashSessionToken(admin),
      adminId: user.id,
      stage: 'full',
      expiresAt: new Date(Date.now() + DAY),
    },
  });
});
afterAll(async () => {
  await app.close();
});

const adminGet = (url: string) =>
  app.inject({
    method: 'GET',
    url: `/api/v1${url}`,
    headers: { authorization: `Bearer ${admin}` },
  });

type Item = { id: string; city: string | null; area: string | null; hasLocation: boolean };

describe('admin customers: location', () => {
  it('a business without a location shows hasLocation false and no area', async () => {
    const list = (await adminGet('/admin/customers')).json() as { items: Item[] };
    expect(list.items[0]).toMatchObject({ id: r.businessId, area: null, hasLocation: false });
    const one = (await adminGet(`/admin/customers/${r.businessId}`)).json();
    expect(one).toMatchObject({ latitude: null, longitude: null, hasLocation: false });
  });

  it('shows what the owner saved in the list, detail, city filter and CSV', async () => {
    const saved = await app.inject({
      method: 'PATCH',
      url: '/api/v1/business/location',
      headers: { authorization: `Bearer ${r.owner.token}` },
      payload: {
        lat: 9.0108,
        lng: 38.7613,
        address: 'Bole Road',
        city: 'Addis Ababa',
        area: 'Bole',
        landmark: 'Next to Edna Mall',
      },
    });
    expect(saved.statusCode).toBe(200);

    const list = (await adminGet('/admin/customers')).json() as { items: Item[] };
    expect(list.items[0]).toMatchObject({ city: 'Addis Ababa', area: 'Bole', hasLocation: true });

    const one = (await adminGet(`/admin/customers/${r.businessId}`)).json();
    expect(one).toMatchObject({
      latitude: 9.0108,
      longitude: 38.7613,
      address: 'Bole Road',
      city: 'Addis Ababa',
      area: 'Bole',
      landmark: 'Next to Edna Mall',
      hasLocation: true,
    });
    expect(one.locationSetAt).toEqual(expect.any(String));

    // The city filter matches part of the name, ignoring case.
    for (const city of ['Addis', 'addis ababa']) {
      const found = (
        await adminGet(`/admin/customers?city=${encodeURIComponent(city)}`)
      ).json() as {
        items: Item[];
      };
      expect(found.items.map((i) => i.id)).toEqual([r.businessId]);
    }
    const none = (await adminGet('/admin/customers?city=Hawassa')).json() as { items: Item[] };
    expect(none.items).toHaveLength(0);

    const csv = await adminGet('/admin/customers.csv');
    expect(csv.statusCode).toBe(200);
    // The first character is the byte order mark Excel needs.
    const [header, row] = csv.body.slice(1).split('\r\n');
    expect(header).toContain('"City","Area"');
    expect(row).toContain('"Addis Ababa","Bole"');
  });
});
