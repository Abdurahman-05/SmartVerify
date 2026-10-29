import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchReceipt, type FetchedReceipt } from '../modules/verification/fetch-receipt.js';
import {
  createRestaurant,
  createTestApp,
  headers,
  newKey,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

vi.mock('../modules/verification/fetch-receipt.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/verification/fetch-receipt.js')>();
  return { ...real, fetchReceipt: vi.fn() };
});
const fetchMock = vi.mocked(fetchReceipt);

const HOUR = 60 * 60 * 1000;
const URL_OK = 'https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt';
// Smart Verify's own CBE account (test values).
const PAY_TO = {
  SUBSCRIPTION_CBE_ACCOUNT: '1000999990001',
  SUBSCRIPTION_CBE_NAME: 'Smart Verify PLC',
};

const detail = JSON.parse(
  readFileSync(new URL('./fixtures/cbe-detail.json', import.meta.url), 'utf8')
) as Record<string, unknown>;

/** A CBE to CBE receipt to Smart Verify, paid an hour ago, with changes. */
function receipt(changes: Record<string, unknown> = {}): FetchedReceipt {
  const body = {
    ...detail,
    platformTransactionType: 'A2A',
    creditAccountHolder: 'SMART VERIFY PLC',
    creditAccountNo: '1****0001',
    description: 'plan',
    paymentDetails: ['plan'],
    amountCredited: '4000.00',
    dateTimes: [new Date(Date.now() - HOUR).toISOString()],
    ...changes,
  };
  return { contentType: 'application/json', body: Buffer.from(JSON.stringify(body)) };
}

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp(PAY_TO);
  await resetDatabase(app);
  r = await createRestaurant(app);
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  fetchMock.mockReset();
});

const pay = (body: Record<string, unknown>, token = r.owner.token, key = newKey()) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/subscription/pay',
    headers: headers(token, key),
    payload: body,
  });

describe('paying for a plan with a CBE transfer', () => {
  it('shows where to pay (owner only)', async () => {
    const info = await app.inject({
      method: 'GET',
      url: '/api/v1/subscription/payment-info',
      headers: headers(r.owner.token),
    });
    expect(info.json()).toMatchObject({
      bank: 'CBE',
      accountNumber: PAY_TO.SUBSCRIPTION_CBE_ACCOUNT,
      accountName: PAY_TO.SUBSCRIPTION_CBE_NAME,
      prices: {
        normal: { monthly: 1000, quarterly: 1500 },
        normal_multi: { monthly: 1500 },
        restaurant: { monthly: 4000 },
      },
    });
    const manager = await app.inject({
      method: 'GET',
      url: '/api/v1/subscription/payment-info',
      headers: headers(r.manager.token),
    });
    expect(manager.statusCode).toBe(403);
  });

  it('a receipt to us for the price starts the plan; it cannot pay twice', async () => {
    fetchMock.mockResolvedValueOnce(receipt());
    const res = await pay({ plan: 'restaurant', period: 'monthly', url: URL_OK });
    expect(res.json()).toMatchObject({
      check: { status: 'verified', reference: 'FT26283K4Z9P' },
      subscription: { plan: 'restaurant', period: 'monthly', priceEtb: 4000 },
    });
    const saved = await app.prisma.subscription.findFirst({
      where: { businessId: r.businessId, status: 'active' },
    });
    expect(saved?.paymentReference).toBe('FT26283K4Z9P');

    fetchMock.mockResolvedValueOnce(receipt());
    const again = await pay({ plan: 'restaurant', period: 'monthly', url: URL_OK });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('RECEIPT_USED');
  });

  it('a receipt that does not pay us enough starts nothing', async () => {
    const cases: [Record<string, unknown>, string[]][] = [
      [{ id: 'FT26283AAAAA', amountCredited: '500.00' }, ['AMOUNT_TOO_LOW']],
      [{ id: 'FT26283BBBBB', creditAccountNo: '1****9999' }, ['WRONG_RECEIVER']],
      [{ id: 'FT26283CCCCC', creditAccountHolder: 'SOMEONE ELSE' }, ['WRONG_RECEIVER_NAME']],
    ];
    for (const [changes, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(receipt(changes));
      const res = await pay({ plan: 'normal', period: 'monthly', url: URL_OK });
      expect(res.json(), JSON.stringify(changes)).toMatchObject({
        check: { status: 'not_matching', reasons },
        subscription: null,
      });
    }
    // The plan is still the one paid before.
    const active = await app.prisma.subscription.findFirst({
      where: { businessId: r.businessId, status: 'active' },
    });
    expect(active?.plan).toBe('restaurant');
  });

  it('only the owner pays; without our account it is not available', async () => {
    expect(
      (await pay({ plan: 'normal', period: 'monthly', url: URL_OK }, r.manager.token)).statusCode
    ).toBe(403);

    const bare = await createTestApp();
    const other = await createRestaurant(bare);
    const res = await bare.inject({
      method: 'POST',
      url: '/api/v1/subscription/pay',
      headers: headers(other.owner.token, newKey()),
      payload: { plan: 'normal', period: 'monthly', url: URL_OK },
    });
    expect(res.statusCode).toBe(501);
    await bare.close();
  });
});

describe('paying for a plan with telebirr', () => {
  // Real telebirr receipt page (made-up people): to "Abebe Coffee Bekele", 2519****5678.
  const WALLET = readFileSync(new URL('./fixtures/telebirr-wallet.html', import.meta.url), 'utf8');
  const addis = (d: Date) => {
    const a = new Date(d.getTime() + 3 * HOUR);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(a.getUTCDate())}-${p(a.getUTCMonth() + 1)}-${a.getUTCFullYear()} ${p(a.getUTCHours())}:${p(a.getUTCMinutes())}:${p(a.getUTCSeconds())}`;
  };
  const telebirrPage = (amount: string): FetchedReceipt => ({
    contentType: 'text/html; charset=utf-8',
    body: Buffer.from(
      WALLET.replace(/\d{2}-\d{2}-2026 \d{2}:\d{2}:\d{2}/, addis(new Date(Date.now() - HOUR)))
        .split('10 Birr')
        .join(`${amount} Birr`)
    ),
  });

  it('a telebirr transfer to our number starts the plan; to another number it does not', async () => {
    const tApp = await createTestApp({
      ...PAY_TO,
      SUBSCRIPTION_TELEBIRR: '0911115678',
      SUBSCRIPTION_TELEBIRR_NAME: 'Abebe Coffee Bekele',
    });
    const owner = (await createRestaurant(tApp)).owner.token;
    const payTel = () =>
      tApp.inject({
        method: 'POST',
        url: '/api/v1/subscription/pay',
        headers: headers(owner, newKey()),
        payload: { plan: 'normal', period: 'monthly', telebirrNumber: 'DJD2QW8XTE' },
      });

    fetchMock.mockResolvedValueOnce(telebirrPage('500'));
    expect((await payTel()).json()).toMatchObject({
      check: { status: 'not_matching', reasons: ['AMOUNT_TOO_LOW'] },
      subscription: null,
    });

    fetchMock.mockResolvedValueOnce(telebirrPage('1000'));
    expect((await payTel()).json()).toMatchObject({
      check: { status: 'verified', reference: 'DJD2QW8XTE' },
      subscription: { plan: 'normal', period: 'monthly', priceEtb: 1000 },
    });

    const info = await tApp.inject({
      method: 'GET',
      url: '/api/v1/subscription/payment-info',
      headers: headers(owner),
    });
    expect(info.json()).toMatchObject({
      telebirr: { number: '0911115678', name: 'Abebe Coffee Bekele' },
    });
    await tApp.close();
  });
});

describe('paying for a plan from another bank (chosen by the owner)', () => {
  const EBIRR = readFileSync(new URL('./fixtures/ebirr-receipt.html', import.meta.url), 'utf8');
  const stamp = (d: Date) =>
    new Date(d.getTime() + 3 * HOUR).toISOString().slice(0, 19).replace('T', ' ');
  // eBirr to our CBE account 1000999990001, printed with its middle hidden.
  const ebirrPage = (amount: number, account = '100XXXXXXXX01'): FetchedReceipt => ({
    contentType: 'text/html; charset=utf-8',
    body: Buffer.from(
      EBIRR.replace(
        '{{REASON}}',
        `Bank Transfer of ETB${amount} from 251911000111 To Bank Account ${account}`
      )
        .split('{{AMOUNT}}')
        .join(String(amount))
        .replace('{{STATUS}}', 'Completed')
        .split('{{RECEIPT}}')
        .join('802648940777')
        .split('{{DATE}}')
        .join(stamp(new Date(Date.now() - HOUR)))
    ),
  });
  const PATH = 'kaafimf/7Ca4gqKiADLtuj5VPOWuaQ';

  it('an eBirr transfer to our account starts the plan; the token keeps its case', async () => {
    const oApp = await createTestApp(PAY_TO);
    const owner = (await createRestaurant(oApp)).owner.token;
    const payOther = (body: Record<string, unknown>) =>
      oApp.inject({
        method: 'POST',
        url: '/api/v1/subscription/pay',
        headers: headers(owner, newKey()),
        payload: { plan: 'normal', period: 'monthly', ...body },
      });

    fetchMock.mockResolvedValueOnce(ebirrPage(1000, '100XXXXXXXX99'));
    expect((await payOther({ bank: 'EBR', reference: PATH })).json()).toMatchObject({
      check: { status: 'not_matching', reasons: ['WRONG_RECEIVER'] },
      subscription: null,
    });

    fetchMock.mockResolvedValueOnce(ebirrPage(1000));
    const paid = await payOther({ bank: 'EBR', reference: PATH });
    expect(paid.json()).toMatchObject({
      check: { status: 'verified', reference: '802648940777' },
      subscription: { plan: 'normal', period: 'monthly', priceEtb: 1000 },
    });
    const [url] = fetchMock.mock.calls.at(-1) ?? [];
    expect(url?.href).toBe(`https://receipt.ebirr.com/${PATH}`);
    const latest = await oApp.prisma.subscription.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(latest?.paymentMethod).toBe('ebirr');

    // One way to pay at a time, and the reference must fit the bank.
    expect((await payOther({ bank: 'EBR' })).statusCode).toBe(400);
    expect((await payOther({ bank: 'MPE', reference: 'short' })).statusCode).toBe(400);
    expect((await payOther({ bank: 'MPE', reference: 'UJK0TV2TAO', url: URL_OK })).statusCode).toBe(
      400
    );
    await oApp.close();
  });
});
