import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ebirrParser } from '../modules/verification/banks/ebirr.js';
import { fetchReceipt, type FetchedReceipt } from '../modules/verification/fetch-receipt.js';
import { detectBank, findEbirrReference } from '../modules/verification/ocr.js';
import {
  createRestaurant,
  createTestApp,
  headers,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

// No network in tests: every receipt page comes from here.
vi.mock('../modules/verification/fetch-receipt.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/verification/fetch-receipt.js')>();
  return { ...real, fetchReceipt: vi.fn() };
});
const fetchMock = vi.mocked(fetchReceipt);

const HOUR = 60 * 60 * 1000;
const TEMPLATE = readFileSync(new URL('./fixtures/ebirr-receipt.html', import.meta.url), 'utf8');

const BANK_REASON = 'Bank Transfer of ETB250 from 251911000111 To Bank Account 231XXXX31';
const WALLET_REASON =
  'Transfer of ETB250 to Abebe Coffee Bekele(251912345678) via Cooperative Bank of Oromia';

/** "2026-10-20 15:20:12" in Addis Ababa time (UTC+3), as eBirr prints it. */
const addisStamp = (date: Date) =>
  new Date(date.getTime() + 3 * HOUR).toISOString().slice(0, 19).replace('T', ' ');

function page(
  options: {
    reason?: string;
    amount?: number;
    status?: string;
    receipt?: string;
    paidAgoHours?: number;
  } = {}
): FetchedReceipt {
  const html = TEMPLATE.replace('{{REASON}}', options.reason ?? BANK_REASON)
    .split('{{AMOUNT}}')
    .join(String(options.amount ?? 250))
    .replace('{{STATUS}}', options.status ?? 'Completed')
    .split('{{RECEIPT}}')
    .join(options.receipt ?? '802648940525')
    .split('{{DATE}}')
    .join(addisStamp(new Date(Date.now() - (options.paidAgoHours ?? 1) * HOUR)));
  return { contentType: 'text/html; charset=utf-8', body: Buffer.from(html) };
}
const notFound: FetchedReceipt = {
  contentType: 'text/html; charset=utf-8',
  body: Buffer.from('<html><body>Not Found Page</body></html>'),
};

describe('eBirr receipt page', () => {
  it('reads a receipt sent to a bank account', () => {
    const parsed = ebirrParser.parse(page().body.toString('utf8'));
    expect(parsed).toMatchObject({
      reference: '802648940525',
      amountEtb: 250,
      currency: 'ETB',
      status: 'Completed',
      transfer: 'ebirr_bank',
      destinationAccount: '231****31',
      payerName: 'Kebede Alemu Tadesse',
      payerAccount: '251911000111',
    });
    // 15:20 Addis time is 12:20 UTC.
    expect(parsed?.date.getTime()).toBeGreaterThan(Date.now() - 3 * HOUR);
  });

  it('reads a receipt sent to a wallet: name and phone come from the reason', () => {
    const parsed = ebirrParser.parse(page({ reason: WALLET_REASON }).body.toString('utf8'));
    expect(parsed).toMatchObject({
      transfer: 'ebirr_wallet',
      receiverName: 'Abebe Coffee Bekele',
      receiverAccount: '251912345678',
    });
  });

  it('does not read what it does not know', () => {
    expect(ebirrParser.parse('<html>Not Found Page</html>')).toBeNull();
    expect(ebirrParser.parse(page({ reason: 'Airtime top up' }).body.toString('utf8'))).toBeNull();
  });

  it('finds the link path in an SMS (wrapped over lines), keeping the letters as they are', () => {
    const sms =
      'EBIRR-KAAFI-> Id:802648940525 ETB10 sent to Someone(251935758099) at 20/10/2026 ' +
      'https://receipt.ebirr.com/kaafimf\n/7Ca4gqKiADLtuj5VPOWuaQ';
    expect(findEbirrReference(sms)).toBe('kaafimf/7Ca4gqKiADLtuj5VPOWuaQ');
    expect(findEbirrReference('https://receipt.ebirr.com/kaafimf/G6zUWkHXE6vKnHjFp_-JpQ')).toBe(
      'kaafimf/G6zUWkHXE6vKnHjFp_-JpQ'
    );
    expect(findEbirrReference('https://example.com/kaafimf/7Ca4gqKiADLtuj5VPOWuaQ')).toBeNull();
    expect(detectBank(sms)).toBe('EBR');
  });
});

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
      bankCode: 'BOA',
      accountNumber: '231210431',
      last4: '0431',
      holderName: 'Abebe Coffee Bekele',
    },
  });
});

const PATH = 'kaafimf/7Ca4gqKiADLtuj5VPOWuaQ';
const verify = (body: Record<string, unknown>, token = r.waiter.token) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/verify/ebirr',
    headers: headers(token),
    payload: { reference: PATH, expectedAmountEtb: 200, ...body },
  });

describe('POST /verify/ebirr', () => {
  it('verifies a transfer to our bank account and asks the receipt page with the exact token', async () => {
    fetchMock.mockResolvedValueOnce(page());
    const ok = await verify({});
    expect(ok.json()).toMatchObject({
      status: 'verified',
      reference: '802648940525',
      amountEtb: 250,
      extraEtb: 50,
    });
    const [url] = fetchMock.mock.calls[0] ?? [];
    // The token keeps its capital letters (it is case-sensitive).
    expect(url?.href).toBe('https://receipt.ebirr.com/kaafimf/7Ca4gqKiADLtuj5VPOWuaQ');
  });

  it('refuses another account, too little money, a failed status and an old receipt', async () => {
    const cases: [object, number, string[]][] = [
      [
        { reason: 'Bank Transfer of ETB250 from 251911000111 To Bank Account 231XXXX99' },
        200,
        ['WRONG_RECEIVER'],
      ],
      [
        { reason: 'Bank Transfer of ETB250 from 251911000111 To Bank Account 2312XXXX31' },
        200,
        ['WRONG_RECEIVER'],
      ],
      [{}, 300, ['AMOUNT_TOO_LOW']],
      [{ status: 'Failed' }, 200, ['NOT_SUCCESS']],
      [{ paidAgoHours: 48 }, 200, ['EXPIRED']],
    ];
    for (const [options, expected, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(page(options));
      await app.prisma.transaction.deleteMany();
      const res = await verify({ expectedAmountEtb: expected });
      expect(res.json()).toMatchObject({ status: 'not_matching', reasons });
    }
  });

  it('a wallet receipt needs one of our eBirr numbers, with the same name', async () => {
    fetchMock.mockResolvedValueOnce(page({ reason: WALLET_REASON }));
    expect((await verify({})).json()).toMatchObject({
      status: 'not_matching',
      reasons: ['WRONG_RECEIVER'],
    });

    // eBirr is not a saveable receiving bank yet: the row is added here to test the matching.
    await app.prisma.bank.upsert({
      where: { code: 'EBR' },
      update: {},
      create: { code: 'EBR', name: 'eBirr', shortName: 'eBirr', sortOrder: 99 },
    });
    await app.prisma.bankAccount.create({
      data: {
        businessId: r.businessId,
        bankCode: 'EBR',
        accountNumber: '0912345678',
        last4: '5678',
        holderName: 'Abebe Coffee Bekele',
      },
    });
    fetchMock.mockResolvedValueOnce(page({ reason: WALLET_REASON }));
    expect((await verify({})).json()).toMatchObject({ status: 'verified' });
    fetchMock.mockResolvedValueOnce(
      page({
        reason: WALLET_REASON.replace('Abebe Coffee Bekele', 'Someone Else'),
        receipt: '802648940999',
      })
    );
    expect((await verify({})).json()).toMatchObject({
      status: 'not_matching',
      reasons: ['WRONG_RECEIVER_NAME'],
    });
  });

  it('unknown token: NOT_FOUND; unreadable page: UNPARSEABLE; bad path: 400', async () => {
    fetchMock.mockResolvedValueOnce(notFound);
    expect((await verify({})).json()).toEqual({ status: 'unable_to_verify', reason: 'NOT_FOUND' });
    fetchMock.mockResolvedValueOnce(page({ reason: 'Airtime top up' }));
    expect((await verify({})).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'UNPARSEABLE',
    });
    for (const bad of [
      'nope',
      'kaafimf/short',
      '../etc/passwd',
      'kaafimf/7Ca4gqKiADLtuj5VPOWuaQ/x',
    ]) {
      expect((await verify({ reference: bad })).statusCode).toBe(400);
    }
  });

  it('the same receipt twice is refused (by its receipt number)', async () => {
    fetchMock.mockResolvedValue(page());
    await verify({});
    const again = await verify({ reference: 'kaafimf/G6zUWkHXE6vKnHjFp_-JpQ' });
    expect(again.json()).toMatchObject({ status: 'not_matching', reasons: ['DUPLICATE'] });
    expect(await app.prisma.transaction.count({ where: { bankCode: 'EBR' } })).toBe(1);
  });
});
