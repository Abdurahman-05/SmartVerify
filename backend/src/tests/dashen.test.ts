import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchReceipt,
  ReceiptFetchError,
  type FetchedReceipt,
} from '../modules/verification/fetch-receipt.js';
import { findDashenReference, findReference } from '../modules/verification/ocr.js';
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
// A real Dashen receipt page with made-up names, accounts and references (same HTML):
// ETB 12.00 to "Abebe Coffee Bekele", account 5555******678, at Dashen Bank.
const RECEIPT = readFileSync(new URL('./fixtures/dashen-receipt.html', import.meta.url), 'utf8');

/** "Oct 14, 2026, 09:23:02 am" in Addis Ababa time (UTC+3), as Dashen prints it. */
function addisTime(date: Date) {
  const a = new Date(date.getTime() + 3 * HOUR);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const h = a.getUTCHours();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${months[a.getUTCMonth()]} ${a.getUTCDate()}, ${a.getUTCFullYear()}, ` +
    `${pad(h % 12 || 12)}:${pad(a.getUTCMinutes())}:${pad(a.getUTCSeconds())} ${h < 12 ? 'am' : 'pm'}`
  );
}

/** The page paid an hour ago (the fixture is older than the 24h limit), with optional swaps. */
function page(swaps: [string, string][] = []): FetchedReceipt {
  let body = RECEIPT.replace(
    /[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{2}:\d{2}:\d{2} [ap]m/,
    addisTime(new Date(Date.now() - HOUR))
  );
  for (const [from, to] of swaps) body = body.split(from).join(to);
  return { contentType: 'text/html; charset=utf-8', body: Buffer.from(body) };
}

describe('finding the Dashen FT Ref', () => {
  it('reads it after "FT Ref" or from the receipt link, not the longer Transaction Ref', () => {
    const screen =
      'Sender Name: Kebede Date: Oct 14, 2026 09:23 AM FT Ref: C65WDTI262870002 ' +
      'Transaction Ref: WDTI16243067867508811603 Status: Success';
    expect(findDashenReference(screen)).toBe('C65WDTI262870002');
    expect(findDashenReference('https://receipts.dashenbanksc.com/receipt/C65WDTI262870002')).toBe(
      'C65WDTI262870002'
    );
    expect(findReference('DAS', 'Money Successfully Sent! 12.00 ETB')).toBeNull();
  });
});

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
  // Our Dashen account, printed on receipts as 5555******678.
  await app.prisma.bankAccount.create({
    data: {
      businessId: r.businessId,
      bankCode: 'DAS',
      accountNumber: '5555000000678',
      last4: '0678',
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
  app.inject({
    method: 'POST',
    url: '/api/v1/verify/dashen',
    headers: headers(token),
    payload: body,
  });

describe('POST /verify/dashen', () => {
  it('our Dashen account (first 4 + last 3) and holder name; amount and receiver checked', async () => {
    fetchMock.mockResolvedValueOnce(page());
    expect(
      (await verify({ reference: 'c65wdti261110001', expectedAmountEtb: 12 })).json()
    ).toMatchObject({
      status: 'verified',
      reference: 'C65WDTI261110001',
      amountEtb: 12,
      extraEtb: 0,
    });
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url?.href).toBe('https://receipts.dashenbanksc.com/receipt/C65WDTI261110001');

    const cases: [[string, string][], number, string[]][] = [
      [[['Abebe Coffee Bekele', 'Fahmi Abdi Arebo']], 12, ['WRONG_RECEIVER_NAME']],
      [[['5555******678', '5555******999']], 12, ['WRONG_RECEIVER']],
      [[], 50, ['AMOUNT_TOO_LOW']],
    ];
    for (const [swaps, expectedAmountEtb, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(page(swaps));
      const res = await verify(
        { reference: 'C65WDTI261110001', expectedAmountEtb },
        r.manager.token
      );
      expect(res.json(), JSON.stringify(swaps)).toMatchObject({ status: 'not_matching', reasons });
    }
  });

  it('a transfer to Telebirr is checked against our Telebirr number (251******175)', async () => {
    const telebirr = await app.prisma.bankAccount.create({
      data: {
        businessId: r.businessId,
        bankCode: 'TEL',
        accountNumber: '0911223175',
        last4: '3175',
        holderName: 'Abebe Coffee Bekele',
      },
    });
    const toWallet = (number: string): [string, string][] => [
      ['Transfer to Dashen Bank', 'Telebirr Transfer'],
      ['5555******678', number],
    ];
    fetchMock.mockResolvedValueOnce(page(toWallet('+251******175')));
    expect(
      (await verify({ reference: 'C65LTWI261110001', expectedAmountEtb: 12 })).json()
    ).toMatchObject({ status: 'verified', amountEtb: 12 });

    fetchMock.mockResolvedValueOnce(page(toWallet('+251******999')));
    expect(
      (await verify({ reference: 'C65LTWI261110001', expectedAmountEtb: 12 })).json()
    ).toMatchObject({ status: 'not_matching', reasons: ['WRONG_RECEIVER'] });
    await app.prisma.bankAccount.delete({ where: { id: telebirr.id } });
  });

  it('an unknown FT Ref is NOT_FOUND (saved as a failed try); a bad one is refused', async () => {
    // Dashen answers 400 "Transaction not found"; the fetcher turns that into NOT_FOUND.
    fetchMock.mockRejectedValueOnce(new ReceiptFetchError('NOT_FOUND'));
    expect(
      (await verify({ reference: 'C65WDTI269999999', expectedAmountEtb: 12 }, r.owner.token)).json()
    ).toEqual({ status: 'unable_to_verify', reason: 'NOT_FOUND' });
    expect(
      await app.prisma.receiptCheck.findFirst({
        where: { businessId: r.businessId, bankCode: 'DAS' },
      })
    ).not.toBeNull();

    const bad = await verify({ reference: 'C65-WDTI', expectedAmountEtb: 12 }, r.owner.token);
    expect(bad.statusCode).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
