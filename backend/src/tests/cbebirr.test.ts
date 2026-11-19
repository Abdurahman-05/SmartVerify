import { existsSync, readdirSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { cbeBirrParser } from '../modules/verification/banks/cbebirr.js';
import {
  fetchReceipt,
  ReceiptFetchError,
  type FetchedReceipt,
} from '../modules/verification/fetch-receipt.js';
import { findCbeBirrLink } from '../modules/verification/verification.service.js';
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

// A "PDF" whose bytes are "%PDF-FAKE" + the receipt text is read as that text: the committed
// samples need no real (personal) PDF. Everything else goes to the real pdf-parse, so the real
// sample (kept out of git) is read for real below.
vi.mock('pdf-parse', async (importOriginal) => {
  const real = await importOriginal<typeof import('pdf-parse')>();
  const FAKE = '%PDF-FAKE\n';
  class PDFParse {
    private readonly fake: string | null;
    private readonly inner: InstanceType<typeof real.PDFParse> | null;
    constructor(options: ConstructorParameters<typeof real.PDFParse>[0]) {
      const text = Buffer.from((options as { data: Uint8Array }).data).toString('utf8');
      this.fake = text.startsWith(FAKE) ? text.slice(FAKE.length) : null;
      this.inner = this.fake === null ? new real.PDFParse(options) : null;
    }
    getText() {
      return this.inner ? this.inner.getText() : Promise.resolve({ text: this.fake });
    }
    destroy() {
      return this.inner ? this.inner.destroy() : Promise.resolve();
    }
  }
  return { ...real, PDFParse };
});

const HOUR = 60 * 60 * 1000;
const LINK = 'https://cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2&PH=251900000111';
const SMS =
  'Dear ABEBE, you have transferred ETB 10.00 to account 1000****5678 ABEBE COFFEE BEKELE on ' +
  '19/11/2026 10:14. Txn ID DKJ21AAA2J2 FT26323AAAAA. Invoice: ' +
  `${LINK} Thank you for using CBE Birr.`;

/** "2026-11-19 10:14" in Addis Ababa time (UTC+3), as the PDF prints it. */
function addisTime(date: Date) {
  const a = new Date(date.getTime() + 3 * HOUR);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${a.getUTCFullYear()}-${pad(a.getUTCMonth() + 1)}-${pad(a.getUTCDate())} ` +
    `${pad(a.getUTCHours())}:${pad(a.getUTCMinutes())}`
  );
}

/**
 * The text of a real CBE Birr receipt PDF in its own layout, with made-up names, accounts and IDs.
 * Paid an hour ago: 10 ETB to "ABEBE COFFEE BEKELE", credit account 1000****5678 at CBE.
 */
function receiptText(swaps: [string, string][] = []) {
  let text = [
    'Commercial Bank of Ethiopia',
    'VAT Invoice/ Customer Receipt',
    'CBEBirr',
    'Company Address & Other Information Customer Information',
    'Country: Ethiopia',
    'Customer Name:',
    'kebede alemu tadesse',
    'Transaction Information',
    'Debit Account 0900000111 - kebede alemu tadesse',
    'Credit Account 1000****5678 - CBE',
    'Receiver Name ABEBE COFFEE BEKELE',
    'Order ID FT26323AAAAA',
    'Transaction Status Completed',
    'Reference :',
    'Transaction Details',
    'Receipt Number Transaction Date Amount',
    `DKJ21AAA2J2 ${addisTime(new Date(Date.now() - HOUR))} 10.00`,
    '10.00',
    '0.00',
    'Paid amount',
    'Total Paid Amount',
    'Ten ETB and zero Cents .',
  ].join('\n');
  for (const [from, to] of swaps) text = text.split(from).join(to);
  return text;
}

const pdf = (swaps: [string, string][] = []): FetchedReceipt => ({
  contentType: 'application/pdf',
  body: Buffer.from(`%PDF-FAKE\n${receiptText(swaps)}`),
});

describe('reading the CBE Birr link', () => {
  it('finds the link in the SMS and in a scanned QR, only on cbepay1.cbe.com.et', () => {
    expect(findCbeBirrLink(SMS)?.href).toBe(LINK);
    expect(findCbeBirrLink(LINK)?.href).toBe(LINK);
    expect(findCbeBirrLink(`${LINK}.`)?.href).toBe(LINK);
    for (const bad of [
      'http://cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2&PH=251900000111',
      'https://cbepay1.cbe.com.et.evil.et/aureceipt?TID=DKJ21AAA2J2&PH=251900000111',
      'https://evil.example.com/aureceipt?TID=DKJ21AAA2J2&PH=251900000111',
      'https://cbepay1.cbe.com.et/other?TID=DKJ21AAA2J2&PH=251900000111',
      'https://cbepay1.cbe.com.et/aureceipt/x?TID=DKJ21AAA2J2&PH=251900000111',
      'https://cbepay1.cbe.com.et:8443/aureceipt?TID=DKJ21AAA2J2&PH=251900000111',
      'https://x@cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2&PH=251900000111',
      'https://cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2&PH=251900000111&next=http://10.0.0.1',
      'https://cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2',
      'https://cbepay1.cbe.com.et/aureceipt?TID=../../x&PH=251900000111',
      'https://cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2&PH=abc',
      'https://cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2&PH=251900000111#x',
      'https://shorturl.at/WISQB',
      'no link at all',
    ]) {
      expect(findCbeBirrLink(bad), bad).toBeNull();
    }
  });

  it('reads every field of the (masked) PDF text', () => {
    const r = cbeBirrParser.parse(receiptText());
    expect(r).toMatchObject({
      payerName: 'kebede alemu tadesse',
      payerAccount: '',
      receiverName: 'ABEBE COFFEE BEKELE',
      receiverAccount: '1000****5678',
      amountEtb: 10,
      currency: 'ETB',
      reference: 'DKJ21AAA2J2',
      altReference: 'FT26323AAAAA',
      status: 'Completed',
      transfer: 'cbebirr',
      destinationBank: 'CBE',
    });
    // 10:14 Addis = 07:14 UTC.
    const fixed = receiptText().replace(
      /\d{4}-\d{2}-\d{2} \d{2}:\d{2} 10\.00/,
      '2026-11-19 10:14 10.00'
    );
    expect(cbeBirrParser.parse(fixed)?.date.toISOString()).toBe('2026-11-19T07:14:00.000Z');
  });

  it('a missing required field is not a receipt', () => {
    for (const label of ['Receiver Name', 'Order ID', 'Transaction Status', 'Receipt Number']) {
      expect(cbeBirrParser.parse(receiptText([[label, 'Zzz']])), label).toBeNull();
    }
    expect(cbeBirrParser.parse('<html>Maintenance</html>')).toBeNull();
  });

  // The real sample (kept out of git) must read the same way, through the real PDF library.
  const real = new URL('../../test/fixtures/cbebirr/Receipt.pdf', import.meta.url);
  it.skipIf(!existsSync(real))('reads the real sample PDF', async () => {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(readFileSync(real)) });
    const { text } = await parser.getText();
    await parser.destroy();
    const r = cbeBirrParser.parse(text);
    expect(r).toMatchObject({ transfer: 'cbebirr', currency: 'ETB', status: 'Completed' });
    expect(r?.reference).toMatch(/^DKJ[A-Z0-9]+$/);
    expect(r?.altReference).toMatch(/^FT[A-Z0-9]{10}$/);
  });
});

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
  // Our CBE account: the PDF shows it as 1000****5678.
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
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  fetchMock.mockReset();
});

const verifyOnce = (body: Record<string, unknown>, url = '/api/v1/verify/cbebirr') =>
  app.inject({ method: 'POST', url, headers: headers(r.waiter.token), payload: body });
// Each check starts as the first use of the receipt, except in the duplicate tests.
const verify = async (body: Record<string, unknown>) => {
  await app.prisma.transaction.deleteMany();
  return verifyOnce(body);
};

describe('POST /verify/cbebirr', () => {
  it('success from the SMS and from the QR text; only the PDF is trusted', async () => {
    fetchMock.mockResolvedValueOnce(pdf());
    expect((await verify({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'verified',
      reference: 'DKJ21AAA2J2',
      altReference: 'FT26323AAAAA',
      amountEtb: 10,
      extraEtb: 0,
      matchedBy: 'account',
    });
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url?.href).toBe(LINK);
    expect(options).toMatchObject({
      tlsStrict: true,
      timeoutMs: 8000,
      maxBytes: 2 * 1024 * 1024,
    });

    fetchMock.mockResolvedValueOnce(pdf());
    expect((await verify({ text: LINK, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'verified',
    });

    // A forged SMS claiming a different amount changes nothing: the PDF says 10 ETB.
    fetchMock.mockResolvedValueOnce(pdf());
    expect(
      (await verify({ text: `ETB 5000 paid. ${LINK}`, expectedAmountEtb: 5000 })).json()
    ).toMatchObject({ status: 'not_matching', reasons: ['AMOUNT_TOO_LOW'] });
  });

  it('wrong amount, wrong receiver, wrong name, not successful, too old', async () => {
    const old = [
      [addisTime(new Date(Date.now() - HOUR)), addisTime(new Date(Date.now() - 48 * HOUR))],
    ];
    const cases: [[string, string][], number, string[]][] = [
      [[], 50, ['AMOUNT_TOO_LOW']],
      [[['1000****5678', '1000****9999']], 10, ['WRONG_RECEIVER']],
      [[['1000****5678', '2000****5678']], 10, ['WRONG_RECEIVER']],
      [
        [['Credit Account 1000****5678 - CBE', 'Credit Account 1000****5678 - Dashen Bank']],
        10,
        ['WRONG_RECEIVER'],
      ],
      [[['ABEBE COFFEE BEKELE', 'FAHMI ABDI AREBO']], 10, ['WRONG_RECEIVER_NAME']],
      [[['Completed', 'Failed']], 10, ['NOT_SUCCESS']],
      [old as [string, string][], 10, ['EXPIRED']],
    ];
    for (const [swaps, expectedAmountEtb, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(pdf(swaps));
      const res = await verify({ text: SMS, expectedAmountEtb });
      expect(res.json(), JSON.stringify(swaps)).toMatchObject({ status: 'not_matching', reasons });
    }
  });

  it('no account on the PDF: matched by name, and it says so', async () => {
    fetchMock.mockResolvedValueOnce(pdf([['Credit Account 1000****5678 - CBE\n', '']]));
    expect((await verify({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'verified',
      matchedBy: 'name',
    });
    fetchMock.mockResolvedValueOnce(
      pdf([
        ['Credit Account 1000****5678 - CBE\n', ''],
        ['ABEBE COFFEE BEKELE', 'FAHMI ABDI AREBO'],
      ])
    );
    expect((await verify({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'not_matching',
      reasons: ['WRONG_RECEIVER'],
    });
  });

  it('an HTML answer, fake PDF bytes, a timeout or a bad status never verify', async () => {
    const cannot = { status: 'unable_to_verify' };
    const answers: [() => void, unknown][] = [
      [
        () =>
          fetchMock.mockResolvedValueOnce({
            contentType: 'text/html;charset=utf-8',
            body: Buffer.from('<html><body>Receipt</body></html>'),
          }),
        { ...cannot, reason: 'UNPARSEABLE' },
      ],
      [
        // Says PDF, is HTML.
        () =>
          fetchMock.mockResolvedValueOnce({
            contentType: 'application/pdf',
            body: Buffer.from('<html>' + receiptText()),
          }),
        { ...cannot, reason: 'UNPARSEABLE' },
      ],
      [
        // Is a PDF, says HTML.
        () =>
          fetchMock.mockResolvedValueOnce({
            contentType: 'text/html',
            body: pdf().body,
          }),
        { ...cannot, reason: 'UNPARSEABLE' },
      ],
      [
        () =>
          fetchMock.mockResolvedValueOnce({
            contentType: 'application/pdf',
            body: Buffer.alloc(0),
          }),
        { ...cannot, reason: 'UNPARSEABLE' },
      ],
      [
        () => fetchMock.mockRejectedValueOnce(new ReceiptFetchError('TIMEOUT')),
        { ...cannot, reason: 'TIMEOUT' },
      ],
      [
        () => fetchMock.mockRejectedValueOnce(new ReceiptFetchError('UNREACHABLE')),
        { ...cannot, reason: 'UNREACHABLE' },
      ],
      [
        () => fetchMock.mockRejectedValueOnce(new ReceiptFetchError('NOT_FOUND')),
        { ...cannot, reason: 'NOT_FOUND' },
      ],
    ];
    for (const [arrange, expected] of answers) {
      arrange();
      expect((await verify({ text: SMS, expectedAmountEtb: 10 })).json()).toEqual(expected);
    }
  });

  it('a blocked host, path or extra parameter is refused without fetching', async () => {
    for (const text of [
      'https://evil.example.com/aureceipt?TID=DKJ21AAA2J2&PH=251900000111',
      'http://cbepay1.cbe.com.et/aureceipt?TID=DKJ21AAA2J2&PH=251900000111',
      'https://cbepay1.cbe.com.et/admin?TID=DKJ21AAA2J2&PH=251900000111',
      `${LINK}&redirect=http://169.254.169.254/`,
    ]) {
      const res = await verify({ text, expectedAmountEtb: 10 });
      expect(res.statusCode, text).toBe(400);
      expect(res.json(), text).toMatchObject({ error: { code: 'INVALID_URL' } });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the same receipt twice is a DUPLICATE; the link, phone and PDF are not stored', async () => {
    await app.prisma.transaction.deleteMany();
    fetchMock.mockResolvedValueOnce(pdf()).mockResolvedValueOnce(pdf());
    expect((await verifyOnce({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'verified',
    });
    expect((await verifyOnce({ text: LINK, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'not_matching',
      reasons: ['DUPLICATE'],
    });
    const stored = JSON.stringify([
      await app.prisma.transaction.findMany(),
      await app.prisma.receiptCheck.findMany(),
    ]);
    expect(stored).toContain('DKJ21AAA2J2');
    expect(stored).toContain('FT26323AAAAA');
    expect(stored).not.toContain('251900000111');
    expect(stored).not.toContain('0900000111');
    expect(stored).not.toContain('aureceipt');
  });

  it('the same payment is never accepted twice through CBE and CBE Birr', async () => {
    const MB = 'https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt';
    const cbeJson = (): FetchedReceipt => ({
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({
          ...(JSON.parse(
            readFileSync(new URL('./fixtures/cbe-detail.json', import.meta.url), 'utf8')
          ) as object),
          id: 'FT26323AAAAA',
          dateTimes: [new Date(Date.now() - HOUR).toISOString()],
          platformTransactionType: 'A2A',
          creditAccountHolder: 'ABEBE COFFEE BEKELE',
          creditAccountNo: '1****5678',
          amountCredited: '10.00',
          description: 'x',
        })
      ),
    });

    // CBE Birr first, then the same payment through CBE.
    await app.prisma.transaction.deleteMany();
    fetchMock.mockResolvedValueOnce(pdf());
    expect((await verifyOnce({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'verified',
    });
    fetchMock.mockResolvedValueOnce(cbeJson());
    expect(
      (await verifyOnce({ url: MB, expectedAmountEtb: 10 }, '/api/v1/verify/cbe')).json()
    ).toMatchObject({ status: 'not_matching', reasons: ['DUPLICATE'] });

    // CBE first, then the same payment through CBE Birr.
    await app.prisma.transaction.deleteMany();
    fetchMock.mockResolvedValueOnce(cbeJson());
    expect(
      (await verifyOnce({ url: MB, expectedAmountEtb: 10 }, '/api/v1/verify/cbe')).json()
    ).toMatchObject({ status: 'verified', reference: 'FT26323AAAAA' });
    fetchMock.mockResolvedValueOnce(pdf());
    expect((await verifyOnce({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'not_matching',
      reasons: ['DUPLICATE'],
    });
  });

  it('writes nothing to disk: no file in the temp folder, no write call', async () => {
    const write = vi.spyOn(fs, 'writeFile');
    const before = readdirSync(tmpdir()).sort();
    fetchMock.mockResolvedValueOnce(pdf());
    expect((await verify({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'verified',
    });
    fetchMock.mockResolvedValueOnce({
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4 broken'),
    });
    expect((await verify({ text: SMS, expectedAmountEtb: 10 })).json()).toMatchObject({
      status: 'unable_to_verify',
    });
    expect(readdirSync(tmpdir()).sort()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
});
