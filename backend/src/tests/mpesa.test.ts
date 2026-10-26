import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { mpesaParser } from '../modules/verification/banks/mpesa.js';
import { fetchReceipt, type FetchedReceipt } from '../modules/verification/fetch-receipt.js';
import { detectBank, findMpesaNumber } from '../modules/verification/ocr.js';
import {
  createRestaurant,
  createTestApp,
  headers,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

// No network and no real PDFs in tests: the receipt text comes from here.
const pdf = vi.hoisted(() => ({ text: '' }));
vi.mock('pdf-parse', () => ({
  PDFParse: class {
    getText = async () => ({ text: pdf.text });
    destroy = async () => {};
  },
}));
vi.mock('../modules/verification/fetch-receipt.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/verification/fetch-receipt.js')>();
  return { ...real, fetchReceipt: vi.fn() };
});
const fetchMock = vi.mocked(fetchReceipt);

const HOUR = 60 * 60 * 1000;
const TEMPLATE = readFileSync(new URL('./fixtures/mpesa-receipt.txt', import.meta.url), 'utf8');

/** "2026-10-20 15:31:11" in Addis Ababa time (UTC+3), as M-PESA prints it. */
function addisStamp(date: Date) {
  return new Date(date.getTime() + 3 * HOUR).toISOString().slice(0, 19).replace('T', ' ');
}
const receiptText = (swaps: [string, string][] = [], paidAgoHours = 1) =>
  swaps.reduce(
    (text, [from, to]) => text.split(from).join(to),
    TEMPLATE.replace('{{DATE}}', addisStamp(new Date(Date.now() - paidAgoHours * HOUR)))
  );

/** What M-PESA's API answers: JSON holding the receipt PDF (the PDF text is mocked above). */
const answer = (text: string): FetchedReceipt => {
  pdf.text = text;
  return {
    contentType: 'application/json; charset=utf-8',
    body: Buffer.from(
      JSON.stringify({ responseCode: '0', responseDescription: 'Success', base64Data: 'JVBERi0=' })
    ),
  };
};
const notFound: FetchedReceipt = {
  contentType: 'application/json; charset=utf-8',
  body: Buffer.from(
    JSON.stringify({
      responseCode: '2032',
      responseDescription: 'The transaction receipt number does not exist.',
    })
  ),
};

describe('M-PESA receipt text', () => {
  it('reads the sample receipt layout', () => {
    const parsed = mpesaParser.parse(receiptText());
    expect(parsed).toMatchObject({
      reference: 'KLM3NP4QRS',
      amountEtb: 250,
      currency: 'ETB',
      status: 'Success',
      transfer: 'wallet_to_bank',
      receiverName: 'ABEBE COFFEE BEKELE',
      receiverAccount: '1000123455678',
      destinationAccount: '1000123455678',
      destinationBank: 'Commercial Bank Of Ethiopia',
      payerName: 'Kebede Alemu Tadesse',
    });
  });

  it('does not read what it does not know', () => {
    expect(mpesaParser.parse('')).toBeNull();
    // A receipt without a bank account row (e.g. to an M-PESA wallet) is not read yet.
    const wallet = receiptText().replace(/\/ BANK ACCOUNT NUMBER[^\n]*\n/, '');
    expect(mpesaParser.parse(wallet)).toBeNull();
  });

  it('finds the number in the SMS, the receipt link and the app', () => {
    const sms =
      'Dear Kebede, you have sent 10.00 Birr to Bank of Abyssinia for account 231210431-X on ' +
      '20/10/26 at 3:31 PM. Transaction number UJK0TV2TAO. Transaction Fee 0.01 Birr. Get your ' +
      'receipt here: https://m-pesabusiness.safaricom.et/receipt/UJK0TV2TAO Use the below link';
    expect(findMpesaNumber(sms)).toBe('UJK0TV2TAO');
    expect(findMpesaNumber('https://m-pesabusiness.safaricom.et/receipt\n/UJK0TV2TAO')).toBe(
      'UJK0TV2TAO'
    );
    expect(findMpesaNumber('/ TRANSACTION ID UJK0TV2TAO\n/ BANK TRANSACTION ID - - -')).toBe(
      'UJK0TV2TAO'
    );
    expect(findMpesaNumber('BANK TRANSACTION ID ABCDEFGH12')).toBeNull();
    expect(findMpesaNumber('Payment Method 21.00 (ETB) Successful')).toBeNull();
    expect(detectBank(sms)).toBe('MPE');
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
      bankCode: 'CBE',
      accountNumber: '1000123455678',
      last4: '5678',
      holderName: 'Abebe Coffee Bekele',
    },
  });
});

const verify = (body: Record<string, unknown>, token = r.waiter.token) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/verify/mpesa',
    headers: headers(token),
    payload: body,
  });

describe('POST /verify/mpesa', () => {
  it('verifies a send-to-bank receipt for our account', async () => {
    fetchMock.mockResolvedValueOnce(answer(receiptText()));
    const ok = await verify({ transactionNumber: 'klm3np4qrs', expectedAmountEtb: 200 });
    expect(ok.json()).toMatchObject({
      status: 'verified',
      reference: 'KLM3NP4QRS',
      amountEtb: 250,
      extraEtb: 50,
    });
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url?.href).toBe(
      'https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=KLM3NP4QRS'
    );
  });

  it('refuses a wrong account, a wrong name, too little money and an old receipt', async () => {
    const cases: [[string, string][], number, number, string[]][] = [
      [[['1000123455678', '1000999999999']], 100, 1, ['WRONG_RECEIVER']],
      [[['ABEBE COFFEE BEKELE', 'SOMEONE ELSE']], 100, 1, ['WRONG_RECEIVER_NAME']],
      [[], 300, 1, ['AMOUNT_TOO_LOW']],
      [[], 100, 48, ['EXPIRED']],
    ];
    for (const [swaps, expected, ago, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(answer(receiptText(swaps, ago)));
      const res = await verify({ transactionNumber: 'KLM3NP4QRS', expectedAmountEtb: expected });
      expect(res.json()).toMatchObject({ status: 'not_matching', reasons });
    }
  });

  it('unknown number: NOT_FOUND; unreadable kind: UNPARSEABLE; bad number: 400', async () => {
    fetchMock.mockResolvedValueOnce(notFound);
    const missing = await verify({ transactionNumber: 'ZZZ9ZZ9ZZZ', expectedAmountEtb: 10 });
    expect(missing.json()).toEqual({ status: 'unable_to_verify', reason: 'NOT_FOUND' });
    fetchMock.mockResolvedValueOnce(answer('some other receipt'));
    const other = await verify({ transactionNumber: 'KLM3NP4QRS', expectedAmountEtb: 10 });
    expect(other.json()).toEqual({ status: 'unable_to_verify', reason: 'UNPARSEABLE' });
    expect((await verify({ transactionNumber: 'bad', expectedAmountEtb: 10 })).statusCode).toBe(
      400
    );
  });

  it('the same receipt twice is refused; failed checks are saved', async () => {
    fetchMock.mockResolvedValue(answer(receiptText()));
    await verify({ transactionNumber: 'KLM3NP4QRS', expectedAmountEtb: 200 });
    const again = await verify({ transactionNumber: 'KLM3NP4QRS', expectedAmountEtb: 200 });
    expect(again.json()).toMatchObject({ status: 'not_matching', reasons: ['DUPLICATE'] });
    expect(await app.prisma.transaction.count({ where: { bankCode: 'MPE' } })).toBe(1);
    expect(await app.prisma.receiptCheck.count({ where: { bankCode: 'MPE' } })).toBe(1);
  });
});
