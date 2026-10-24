import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchReceipt, type FetchedReceipt } from '../modules/verification/fetch-receipt.js';
import { deleteOldChecks } from '../modules/verification/record-check.js';
import {
  createRestaurant,
  createTestApp,
  headers,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

// No network in tests: every receipt comes from here.
vi.mock('../modules/verification/fetch-receipt.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/verification/fetch-receipt.js')>();
  return { ...real, fetchReceipt: vi.fn() };
});
const fetchMock = vi.mocked(fetchReceipt);

const HOUR = 60 * 60 * 1000;
const WALLET = readFileSync(new URL('./fixtures/telebirr-wallet.html', import.meta.url), 'utf8');

function addisTime(date: Date) {
  const a = new Date(date.getTime() + 3 * HOUR);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(a.getUTCDate())}-${pad(a.getUTCMonth() + 1)}-${a.getUTCFullYear()} ` +
    `${pad(a.getUTCHours())}:${pad(a.getUTCMinutes())}:${pad(a.getUTCSeconds())}`
  );
}

/** A 10 Birr telebirr receipt paid an hour ago, with its own transaction number. */
function receipt(number: string): FetchedReceipt {
  const body = WALLET.replace(
    /\d{2}-\d{2}-2026 \d{2}:\d{2}:\d{2}/,
    addisTime(new Date(Date.now() - HOUR))
  )
    .split('DJD2QW8XTE')
    .join(number);
  return { contentType: 'text/html; charset=utf-8', body: Buffer.from(body) };
}

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  fetchMock.mockReset();
  await resetDatabase(app);
  r = await createRestaurant(app);
  await app.prisma.bankAccount.create({
    data: {
      businessId: r.businessId,
      bankCode: 'TEL',
      accountNumber: '0911115678',
      last4: '5678',
      holderName: 'Abebe Coffee Bekele',
    },
  });
});

const check = (number: string, token = r.waiter.token, extra: object = {}) => {
  fetchMock.mockResolvedValueOnce(receipt(number));
  return app.inject({
    method: 'POST',
    url: '/api/v1/verify/telebirr',
    headers: headers(token),
    payload: { transactionNumber: number, expectedAmountEtb: 10, ...extra },
  });
};
const history = async (token: string) =>
  (
    await app.inject({
      method: 'GET',
      url: '/api/v1/verify/history?period=today',
      headers: headers(token),
    })
  ).json() as { reference: string; amountEtb: number; checkedBy: string }[];
const failed = async (token: string) =>
  (
    await app.inject({
      method: 'GET',
      url: '/api/v1/verify/failed?period=today',
      headers: headers(token),
    })
  ).json() as { reasons: string[]; reference: string | null }[];

describe('receipt history and duplicates', () => {
  it('a verified receipt is saved and listed; waiters see only their own', async () => {
    expect((await check('AAAA111111')).json()).toMatchObject({ status: 'verified' });
    expect((await check('BBBB222222', r.waiter2.token)).json()).toMatchObject({
      status: 'verified',
    });

    const forOwner = await history(r.owner.token);
    expect(forOwner.map((h) => h.reference).sort()).toEqual(['AAAA111111', 'BBBB222222']);
    expect(forOwner[0]).toMatchObject({ amountEtb: 10 });
    expect((await history(r.waiter.token)).map((h) => h.reference)).toEqual(['AAAA111111']);
  });

  it('the same receipt again is refused as DUPLICATE and saved as a failed check', async () => {
    await check('CCCC333333');
    const again = await check('CCCC333333', r.waiter2.token);
    expect(again.json()).toMatchObject({
      status: 'not_matching',
      reasons: ['DUPLICATE'],
      reference: 'CCCC333333',
      firstCheckedAt: expect.any(String),
    });
    expect((await history(r.owner.token)).map((h) => h.reference)).toEqual(['CCCC333333']);
    expect(await failed(r.owner.token)).toEqual([
      expect.objectContaining({ reasons: ['DUPLICATE'], reference: 'CCCC333333' }),
    ]);
  });

  it('another business cannot reuse a receipt either', async () => {
    await check('DDDD444444');
    const other = await createRestaurant(app);
    await app.prisma.bankAccount.create({
      data: {
        businessId: other.businessId,
        bankCode: 'TEL',
        accountNumber: '0911115678',
        last4: '5678',
        holderName: 'Abebe Coffee Bekele',
      },
    });
    expect((await check('DDDD444444', other.waiter.token)).json()).toMatchObject({
      reasons: ['DUPLICATE'],
    });
  });

  it('checking the same bill again (a lost answer) is not a second use', async () => {
    const order = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(r.waiter.token, `k-${Date.now()}`),
      payload: {
        type: 'takeaway',
        customerName: 'Sara',
        items: [{ menuItemId: r.menu.coffee.id, quantity: 1 }],
      },
    });
    const billId = (order.json() as { id: string }).id;
    expect((await check('EEEE555555', r.waiter.token, { billId })).json()).toMatchObject({
      status: 'verified',
    });
    expect((await check('EEEE555555', r.waiter.token, { billId })).json()).toMatchObject({
      status: 'verified',
    });
    // A different bill is a second use.
    expect((await check('EEEE555555')).json()).toMatchObject({ reasons: ['DUPLICATE'] });
  });

  it('checks older than 4 months are deleted; newer ones stay', async () => {
    await check('FFFF666666');
    await check('FFFF666666'); // a failed (duplicate) check
    const old = new Date();
    old.setMonth(old.getMonth() - 5);
    await app.prisma.transaction.updateMany({ data: { createdAt: old } });
    await app.prisma.receiptCheck.updateMany({ data: { createdAt: old } });
    await check('GGGG777777');

    expect(await deleteOldChecks(app.prisma)).toEqual({ transactions: 1, failedChecks: 1 });
    expect(await app.prisma.transaction.count()).toBe(1);
    expect(await app.prisma.receiptCheck.count()).toBe(0);
  });
});
