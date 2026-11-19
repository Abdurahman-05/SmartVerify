import { existsSync, readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { awashParser } from '../modules/verification/banks/awash.js';
import {
  fetchReceipt,
  ReceiptFetchError,
  type FetchedReceipt,
} from '../modules/verification/fetch-receipt.js';
import { findAwashToken } from '../modules/verification/verification.service.js';
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
// A real Awash receipt page with made-up names, accounts and IDs (same HTML): 13 ETB from
// Awash to "ABEBE COFFEE BEKELE", account 1000123456789 at Commercial Bank of Ethiopia.
const RECEIPT = readFileSync(new URL('./fixtures/awash-receipt.html', import.meta.url), 'utf8');
const LINK = 'https://awashpay.awashbank.com:8225/-2KK18G2AAA-6HVAAA';
const SMS =
  'Dear Customer , You have transferred to other bank ETB  13  To 1000123456789 (ABEBE ' +
  'COFFEE BEKELE) In Commercial Bank of Ethiopia with charge of 0.09 VAT: 0.02  EDRRF 0.01 ETB. ' +
  `Your available Balance is  ETB 60.89. Receipt Link: ${LINK}. Contact Center  8980. ` +
  'Help us do better – Please take our mini survey: https://shorturl.at/WISQB';

/** "2026-11-12 08:22:41 AM" in Addis Ababa time (UTC+3), as Awash prints it. */
function addisTime(date: Date) {
  const a = new Date(date.getTime() + 3 * HOUR);
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = a.getUTCHours();
  return (
    `${a.getUTCFullYear()}-${pad(a.getUTCMonth() + 1)}-${pad(a.getUTCDate())} ` +
    `${pad(h % 12 || 12)}:${pad(a.getUTCMinutes())}:${pad(a.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'}`
  );
}

/** The page paid an hour ago (the fixture is older than the 24h limit), with optional swaps. */
function page(swaps: [string, string][] = []): FetchedReceipt {
  let body = RECEIPT.replace(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [AP]M/,
    addisTime(new Date(Date.now() - HOUR))
  );
  for (const [from, to] of swaps) body = body.split(from).join(to);
  return { contentType: 'text/html;charset=utf-8', body: Buffer.from(body) };
}

describe('reading the Awash receipt', () => {
  it('finds the link in the SMS, only on awashpay.awashbank.com:8225', () => {
    expect(findAwashToken(SMS)).toBe('-2KK18G2AAA-6HVAAA');
    expect(findAwashToken(LINK)).toBe('-2KK18G2AAA-6HVAAA');
    expect(findAwashToken('https://shorturl.at/WISQB')).toBeNull();
    expect(findAwashToken('http://awashpay.awashbank.com:8225/-2KK18G2AAA-6HVAAA')).toBeNull();
    expect(findAwashToken('https://awashpay.awashbank.com/-2KK18G2AAA-6HVAAA')).toBeNull();
    expect(findAwashToken('https://awashpay.awashbank.com:8443/-2KK18G2AAA-6HVAAA')).toBeNull();
    expect(
      findAwashToken('https://awashpay.awashbank.com.evil.et:8225/-2KK18G2AAA-6HVAAA')
    ).toBeNull();
    expect(findAwashToken('https://x@awashpay.awashbank.com:8225/-2KK18G2AAA-6HVAAA')).toBeNull();
    expect(findAwashToken(`${LINK}?next=http://10.0.0.1`)).toBeNull();
    expect(
      findAwashToken('https://awashpay.awashbank.com:8225/awashbirrpro/receipts/x')
    ).toBeNull();
  });

  it('reads every field of the (masked) page', () => {
    const r = awashParser.parse(RECEIPT);
    expect(r).toMatchObject({
      payerName: 'KEBEDE ALEMU TADESSE',
      payerAccount: '25191****111',
      receiverName: 'ABEBE COFFEE BEKELE',
      receiverAccount: '1000123456789',
      amountEtb: 13,
      currency: 'ETB',
      reference: '261112000000001',
      status: 'SUCCESS',
      transfer: 'awash',
      destinationBank: 'CBE',
      reason: 'Lunch',
    });
    // 08:22:41 AM Addis = 05:22:41 UTC.
    expect(r?.date.toISOString()).toBe('2026-11-12T05:22:41.000Z');
    expect(awashParser.parse('<html><title>Receipt not found</title></html>')).toBeNull();
  });

  // The real sample (kept out of git) must read the same way.
  const real = new URL('../../test/fixtures/awash/receipt.html', import.meta.url);
  it.skipIf(!existsSync(real))('reads the real sample page', () => {
    const r = awashParser.parse(readFileSync(real, 'utf8'));
    expect(r).toMatchObject({ amountEtb: 13, destinationBank: 'CBE', status: 'SUCCESS' });
    expect(r?.reference).toMatch(/^\d{15}$/);
  });
});

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
  // Our CBE account, shown in full on the Awash receipt.
  await app.prisma.bankAccount.create({
    data: {
      businessId: r.businessId,
      bankCode: 'CBE',
      accountNumber: '1000123456789',
      last4: '6789',
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

// Each check starts as the first use of the receipt, except in the duplicate test.
const verify = async (body: Record<string, unknown>, token = r.waiter.token) => {
  await app.prisma.transaction.deleteMany();
  return verifyOnce(body, token);
};
const verifyOnce = (body: Record<string, unknown>, token = r.waiter.token) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/verify/awash',
    headers: headers(token),
    payload: body,
  });

describe('POST /verify/awash', () => {
  it('success: our account at the printed bank, holder name, amount, recent', async () => {
    fetchMock.mockResolvedValueOnce(page());
    expect((await verify({ text: SMS, expectedAmountEtb: 13 })).json()).toMatchObject({
      status: 'verified',
      reference: '261112000000001/-2KK18G2AAA-6HVAAA',
      amountEtb: 13,
      extraEtb: 0,
    });
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url?.href).toBe(LINK);
    expect(options).toMatchObject({
      tlsStrict: true,
      timeoutMs: 8000,
      maxBytes: 1024 * 1024,
      samePort: true,
    });

    // A masked account (first and last digits shown) with the right name also fits.
    fetchMock.mockResolvedValueOnce(page([['1000123456789', '1000*****6789']]));
    expect((await verify({ text: LINK, expectedAmountEtb: 13 })).json()).toMatchObject({
      status: 'verified',
    });
  });

  it('wrong amount, wrong receiver, wrong bank, wrong name, not successful', async () => {
    const cases: [[string, string][], number, string[]][] = [
      [[], 50, ['AMOUNT_TOO_LOW']],
      [[['1000123456789', '1000999999999']], 13, ['WRONG_RECEIVER']],
      [[['Commercial Bank of Ethiopia', 'Dashen Bank']], 13, ['WRONG_RECEIVER']],
      [[['Commercial Bank of Ethiopia', 'Some New Bank']], 13, ['WRONG_RECEIVER']],
      [[['ABEBE COFFEE BEKELE', 'FAHMI ABDI AREBO']], 13, ['WRONG_RECEIVER_NAME']],
      [[['Transaction Successful', 'Transaction Failed']], 13, ['NOT_SUCCESS']],
    ];
    for (const [swaps, expectedAmountEtb, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(page(swaps));
      const res = await verify({ text: SMS, expectedAmountEtb }, r.manager.token);
      expect(res.json(), JSON.stringify(swaps)).toMatchObject({ status: 'not_matching', reasons });
    }
  });

  it('the same receipt twice is a DUPLICATE', async () => {
    await app.prisma.transaction.deleteMany();
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(page());
    expect((await verifyOnce({ text: SMS, expectedAmountEtb: 13 })).json()).toMatchObject({
      status: 'verified',
    });
    expect((await verifyOnce({ text: LINK, expectedAmountEtb: 13 })).json()).toMatchObject({
      status: 'not_matching',
      reasons: ['DUPLICATE'],
    });
  });

  it('a fetch timeout, an unknown token or a page that is not a receipt never verifies', async () => {
    fetchMock.mockRejectedValueOnce(new ReceiptFetchError('TIMEOUT'));
    expect((await verify({ text: SMS, expectedAmountEtb: 13 })).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'TIMEOUT',
    });

    fetchMock.mockResolvedValueOnce({
      contentType: 'text/html;charset=utf-8',
      body: Buffer.from('\n\n\n\n\n\nReceipt not found'),
    });
    expect((await verify({ text: SMS, expectedAmountEtb: 13 })).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'NOT_FOUND',
    });

    fetchMock.mockResolvedValueOnce({
      contentType: 'text/html',
      body: Buffer.from('<html><title>Maintenance</title><body>Try later</body></html>'),
    });
    expect((await verify({ text: SMS, expectedAmountEtb: 13 })).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'UNPARSEABLE',
    });
  });

  it('a blocked host or a wrong port is refused without fetching', async () => {
    for (const text of [
      'https://evil.example.com:8225/-2KK18G2AAA-6HVAAA',
      'Receipt Link: https://awashpay.awashbank.com:9999/-2KK18G2AAA-6HVAAA.',
      'https://awashpay.awashbank.com/-2KK18G2AAA-6HVAAA',
    ]) {
      const res = await verify({ text, expectedAmountEtb: 13 });
      expect(res.statusCode, text).toBe(400);
      expect(res.json(), text).toMatchObject({ error: { code: 'INVALID_URL' } });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
