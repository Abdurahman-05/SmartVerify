import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchReceipt, type FetchedReceipt } from '../modules/verification/fetch-receipt.js';
import { findBoaReference } from '../modules/verification/ocr.js';
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
// A real BOA receipt answer with made-up names and accounts (same shape): ETB 6700.00 to
// "ABEBE COFFEE BEKELE", account 100000001.
const RECEIPT = JSON.parse(
  readFileSync(new URL('./fixtures/boa-receipt.json', import.meta.url), 'utf8')
) as { body: Record<string, string>[] };

/** "26/08/26 14:36" in Addis Ababa time (UTC+3), as BOA prints it. */
function addisTime(date: Date) {
  const a = new Date(date.getTime() + 3 * HOUR);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(a.getUTCDate())}/${pad(a.getUTCMonth() + 1)}/${String(a.getUTCFullYear()).slice(2)} ` +
    `${pad(a.getUTCHours())}:${pad(a.getUTCMinutes())}`
  );
}

/** The receipt paid an hour ago, with some fields changed. */
function answer(changes: Record<string, string | undefined> = {}): FetchedReceipt {
  const row = {
    ...RECEIPT.body[0],
    'Transaction Date': addisTime(new Date(Date.now() - HOUR)),
    ...changes,
  };
  return {
    contentType: 'application/json; charset=utf-8',
    body: Buffer.from(JSON.stringify({ ...RECEIPT, body: [row] })),
  };
}

describe('finding the BOA receipt id', () => {
  it('takes FT reference + last 5 digits from the SMS link, else just the FT reference', () => {
    expect(
      findBoaReference('Receipt: https://cs.bankofabyssinia.com\n/slip/?trx=FT26238SRG1T10431')
    ).toBe('FT26238SRG1T10431');
    expect(findBoaReference('Transaction Reference FT26286NDBY5 Bank Name')).toBe('FT26286NDBY5');
  });
});

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
  await app.prisma.bankAccount.create({
    data: {
      businessId: r.businessId,
      bankCode: 'BOA',
      accountNumber: '100000001',
      last4: '0001',
      holderName: 'Abebe Coffee Bekele',
    },
  });
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  fetchMock.mockReset();
});

// These tests are about reading receipts: each check starts as the first use of the receipt
// (the DUPLICATE rule has its own tests in receipt-history.test.ts).
const verify = async (body: Record<string, unknown>, token = r.waiter.token) => {
  await app.prisma.transaction.deleteMany();
  return verifyOnce(body, token);
};
const verifyOnce = (body: Record<string, unknown>, token = r.waiter.token) =>
  app.inject({ method: 'POST', url: '/api/v1/verify/boa', headers: headers(token), payload: body });

describe('POST /verify/boa', () => {
  it('our account and holder name; amount; transfers without a receiver do not count', async () => {
    fetchMock.mockResolvedValueOnce(answer());
    expect(
      (await verify({ reference: 'FT26238AAAAA10431', expectedAmountEtb: 6700 })).json()
    ).toMatchObject({ status: 'verified', reference: 'FT26238AAAAA', amountEtb: 6700 });
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url?.href).toBe(
      'https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26238AAAAA10431'
    );

    const cases: [Record<string, string | undefined>, number, string[]][] = [
      [{ "Receiver's Name": 'FAHMI ABDI AREBO' }, 6700, ['WRONG_RECEIVER_NAME']],
      [{ "Receiver's Account": '100009999' }, 6700, ['WRONG_RECEIVER']],
      // Masked accounts are matched on first and last digits.
      [{ "Receiver's Account": '10******1' }, 6700, []],
      // A transfer to telebirr has no receiver account.
      [{ "Receiver's Account": undefined, "Receiver's Name": undefined }, 6700, ['WRONG_RECEIVER']],
      [{}, 7000, ['AMOUNT_TOO_LOW']],
    ];
    for (const [changes, expectedAmountEtb, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(answer(changes));
      const res = (
        await verify({ reference: 'FT26238AAAAA10431', expectedAmountEtb }, r.manager.token)
      ).json();
      expect(res, JSON.stringify(changes)).toMatchObject(
        reasons.length ? { status: 'not_matching', reasons } : { status: 'verified' }
      );
    }
  });

  it('an unknown id is NOT_FOUND; an id without the 5 digits is refused', async () => {
    fetchMock.mockResolvedValueOnce({
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({ body: [{ "Payer's Name": 'Invalid reference number' }] })),
    });
    expect(
      (
        await verify({ reference: 'FT26238AAAAA99999', expectedAmountEtb: 10 }, r.owner.token)
      ).json()
    ).toEqual({ status: 'unable_to_verify', reason: 'NOT_FOUND' });

    const bad = await verify({ reference: 'FT26238AAAAA', expectedAmountEtb: 10 }, r.owner.token);
    expect(bad.statusCode).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
