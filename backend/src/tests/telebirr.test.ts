import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchReceipt, type FetchedReceipt } from '../modules/verification/fetch-receipt.js';
import { findReference, findTelebirrNumber } from '../modules/verification/ocr.js';
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
// Real telebirr receipt pages with made-up names, phones and account (same HTML).
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const WALLET = fixture('telebirr-wallet.html'); // 10 Birr, 13-10-2026 13:33:02
const TO_BANK = fixture('telebirr-to-bank.html'); // 20 Birr, 14-10-2026 15:04:12

/** "13-10-2026 13:33:02" in Addis Ababa time (UTC+3), as telebirr prints it. */
function addisTime(date: Date) {
  const a = new Date(date.getTime() + 3 * HOUR);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(a.getUTCDate())}-${pad(a.getUTCMonth() + 1)}-${a.getUTCFullYear()} ` +
    `${pad(a.getUTCHours())}:${pad(a.getUTCMinutes())}:${pad(a.getUTCSeconds())}`
  );
}

/** The page paid an hour ago (fixtures are older than the 24h limit), with optional swaps. */
function page(html: string, swaps: [string, string][] = []): FetchedReceipt {
  let body = html.replace(
    /\d{2}-\d{2}-2026 \d{2}:\d{2}:\d{2}/,
    addisTime(new Date(Date.now() - HOUR))
  );
  for (const [from, to] of swaps) body = body.split(from).join(to);
  return { contentType: 'text/html; charset=utf-8', body: Buffer.from(body) };
}

describe('finding the telebirr transaction number', () => {
  it('reads it from the SMS link or after "transaction number", never guesses', () => {
    const sms =
      'You have transferred ETB 10.00 to Abebe (0905****75) on 13/10/2026 13:33:02. Your ' +
      'transaction number is DJD2QW8XTE. ... https://transactioninfo\n.ethiotelecom.et/receipt\n/DJD2QW8XTE.';
    expect(findTelebirrNumber(sms)).toBe('DJD2QW8XTE');
    expect(findTelebirrNumber('Transaction Number DJE7SF7UOX Transaction Time')).toBe('DJE7SF7UOX');
    expect(findTelebirrNumber('Payment Method -21.00 (ETB) Successful')).toBeNull();
    expect(findReference('TEL', 'Your transaction number is DJD2QW8XTE.')).toBe('DJD2QW8XTE');
    expect(findReference('CBE', 'Transaction ID: FT26286JZH4B')).toBe('FT26286JZH4B');
  });
});

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
  await app.prisma.bankAccount.createMany({
    data: [
      // Our telebirr: printed on receipts as 2519****5678.
      {
        businessId: r.businessId,
        bankCode: 'TEL',
        accountNumber: '0911115678',
        last4: '5678',
        holderName: 'Abebe Coffee Bekele',
      },
      // Our CBE account: telebirr-to-bank receipts show it in full.
      {
        businessId: r.businessId,
        bankCode: 'CBE',
        accountNumber: '1000123455678',
        last4: '5678',
        holderName: 'Abebe Coffee Bekele',
      },
    ],
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
    url: '/api/v1/verify/telebirr',
    headers: headers(token),
    payload: body,
  });

describe('POST /verify/telebirr', () => {
  it('telebirr to telebirr: our number (first and last 4) and holder name', async () => {
    fetchMock.mockResolvedValueOnce(page(WALLET));
    const ok = await verify({ transactionNumber: 'djd2qw8xte', expectedAmountEtb: 10 });
    expect(ok.json()).toMatchObject({
      status: 'verified',
      reference: 'DJD2QW8XTE',
      amountEtb: 10,
      extraEtb: 0,
    });
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url?.href).toBe('https://transactioninfo.ethiotelecom.et/receipt/DJD2QW8XTE');

    const cases: [[string, string][], number, string[]][] = [
      [[['Abebe Coffee Bekele', 'Fahmi Abdi Arebo']], 10, ['WRONG_RECEIVER_NAME']],
      [[['2519****5678', '2519****9999']], 10, ['WRONG_RECEIVER']],
      [[], 50, ['AMOUNT_TOO_LOW']],
      [[['>Completed<', '>Failed<']], 10, ['NOT_SUCCESS']],
    ];
    for (const [swaps, expectedAmountEtb, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(page(WALLET, swaps));
      const res = await verify({ transactionNumber: 'DJD2QW8XTE', expectedAmountEtb });
      expect(res.json(), JSON.stringify(swaps)).toMatchObject({ status: 'not_matching', reasons });
    }
  });

  it('telebirr to a bank: our full account number and holder name; the bank name is ignored', async () => {
    fetchMock.mockResolvedValueOnce(page(TO_BANK));
    expect(
      (
        await verify({ transactionNumber: 'DJE7SF7UOX', expectedAmountEtb: 20 }, r.manager.token)
      ).json()
    ).toMatchObject({ status: 'verified', amountEtb: 20 });

    fetchMock.mockResolvedValueOnce(page(TO_BANK, [['1000123455678', '1000123459999']]));
    expect(
      (
        await verify({ transactionNumber: 'DJE7SF7UOX', expectedAmountEtb: 20 }, r.manager.token)
      ).json()
    ).toMatchObject({ status: 'not_matching', reasons: ['WRONG_RECEIVER'] });
  });

  it('an unknown number is NOT_FOUND (saved as a failed try); a bad number is refused', async () => {
    fetchMock.mockResolvedValueOnce({
      contentType: 'text/html; charset=utf-8',
      body: Buffer.from('<html><body>This request is not correct</body></html>'),
    });
    expect(
      (
        await verify({ transactionNumber: 'ABC1234567', expectedAmountEtb: 10 }, r.owner.token)
      ).json()
    ).toEqual({ status: 'unable_to_verify', reason: 'NOT_FOUND' });
    expect(
      await app.prisma.receiptCheck.findFirst({
        where: { businessId: r.businessId, bankCode: 'TEL', reasons: { has: 'NOT_FOUND' } },
      })
    ).not.toBeNull();

    const bad = await verify(
      { transactionNumber: 'DJD2-QW8XT', expectedAmountEtb: 10 },
      r.owner.token
    );
    expect(bad.statusCode).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
