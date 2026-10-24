import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchReceipt,
  ReceiptFetchError,
  type FetchedReceipt,
} from '../modules/verification/fetch-receipt.js';
import {
  createRestaurant,
  createTestApp,
  headers,
  newKey,
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

const URL_OK = 'https://apps.cbe.com.et:100/?id=FT26283K4Z9P00014582';
const MB_URL = 'https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt';

/** Mobile banking receipt JSON in the bank's real shape (made-up values). */
const detailFixture = JSON.parse(
  readFileSync(new URL('./fixtures/cbe-detail.json', import.meta.url), 'utf8')
) as Record<string, unknown>;

function jsonReceipt(changes: Record<string, unknown> = {}): FetchedReceipt {
  const detail = {
    ...detailFixture,
    dateTimes: [new Date(Date.now() - HOUR).toISOString()],
    ...changes,
  };
  return { contentType: 'application/json', body: Buffer.from(JSON.stringify(detail)) };
}
const HOUR = 60 * 60 * 1000;

/** "10/12/2026, 2:35:00 PM" in Addis Ababa time (UTC+3), as CBE prints it. */
function addisTime(date: Date) {
  const a = new Date(date.getTime() + 3 * HOUR);
  const h = a.getUTCHours();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${a.getUTCMonth() + 1}/${a.getUTCDate()}/${a.getUTCFullYear()}, ` +
    `${h % 12 || 12}:${pad(a.getUTCMinutes())}:${pad(a.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'}`
  );
}

interface ReceiptOptions {
  amount?: string;
  receiver?: string;
  status?: string;
  date?: Date;
  omitReference?: boolean;
  receiverName?: string;
  reason?: string;
  /** The real PDF receipt has no status line. */
  omitStatus?: boolean;
}

function receiptLines(o: ReceiptOptions = {}) {
  return [
    'Commercial Bank of Ethiopia',
    'Payer ABEBE KEBEDE',
    'Account 1****1234',
    `Receiver ${o.receiverName ?? 'ABEBE COFFEE'}`,
    `Account ${o.receiver ?? '1****5678'}`,
    `Payment Date & Time ${addisTime(o.date ?? new Date(Date.now() - HOUR))}`,
    ...(o.omitReference ? [] : ['Reference No. (VAT Invoice No) FT26283K4Z9P']),
    `Reason / Type of service ${o.reason ?? 'Transfer'}`,
    `Transferred Amount ${o.amount ?? '600.00'} ETB`,
    ...(o.omitStatus ? [] : [`Status ${o.status ?? 'Success'}`]),
  ];
}

function htmlReceipt(o?: ReceiptOptions): FetchedReceipt {
  const rows = receiptLines(o)
    .map((l) => `<tr><td>${l.replace(/&/g, '&amp;')}</td></tr>`)
    .join('');
  return {
    contentType: 'text/html; charset=utf-8',
    body: Buffer.from(
      `<html><head><style>td{}</style></head><body><table>${rows}</table></body></html>`
    ),
  };
}

/** A real one-page PDF with the receipt lines as text. */
function pdfReceipt(o?: ReceiptOptions): FetchedReceipt {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const content =
    'BT /F1 11 Tf 40 760 Td ' +
    receiptLines(o)
      .map((l) => `(${esc(l)}) Tj 0 -16 Td`)
      .join(' ') +
    ' ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { contentType: 'application/pdf', body: Buffer.from(pdf, 'latin1') };
}

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
  await app.prisma.bankAccount.createMany({
    data: [
      // CBE to CBE receipts: last 4 + holder name.
      {
        businessId: r.businessId,
        bankCode: 'CBE',
        accountNumber: '1000123455678',
        last4: '5678',
        holderName: 'Abebe Coffee',
      },
      // CBE to another bank: the full number is in the receipt's reason (fixture description).
      { businessId: r.businessId, bankCode: 'AWA', accountNumber: '2900000000011', last4: '0011' },
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
    url: '/api/v1/verify/cbe',
    headers: headers(token),
    payload: body,
  });

describe('POST /verify/cbe', () => {
  it('refuses links that are not a CBE receipt (INVALID_URL) without fetching', async () => {
    for (const url of [
      'https://evil.example.com/?id=FT26283K4Z9P00014582',
      'https://apps.cbe.com.et.evil.com/?id=FT26283K4Z9P00014582',
      'http://apps.cbe.com.et/?id=FT26283K4Z9P00014582',
      'https://user:pass@apps.cbe.com.et/?id=FT26283K4Z9P00014582',
      'https://apps.cbe.com.et:8443/?id=FT26283K4Z9P00014582',
      'https://apps.cbe.com.et/?id=FT26283K4Z9P0001458',
      'https://apps.cbe.com.et/?id=XX26283K4Z9P00014582',
      'https://apps.cbe.com.et/?id=ft26283k4z9p00014582',
      'https://apps.cbe.com.et/',
      'not a url',
    ]) {
      const res = await verify({ url, expectedAmountEtb: 600 }, r.manager.token);
      expect(res.statusCode, url).toBe(400);
      expect(res.json().error.code, url).toBe('INVALID_URL');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verifies a PDF receipt and an HTML receipt', async () => {
    fetchMock.mockResolvedValueOnce(pdfReceipt());
    const pdf = await verify({ url: URL_OK, expectedAmountEtb: 600 });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.json()).toMatchObject({
      status: 'verified',
      reference: 'FT26283K4Z9P',
      amountEtb: 600,
      extraEtb: 0,
      payerName: 'ABEBE KEBEDE',
      receiverName: 'ABEBE COFFEE',
    });

    fetchMock.mockResolvedValueOnce(htmlReceipt());
    const html = await verify({ url: URL_OK, expectedAmountEtb: 600 }, r.owner.token);
    expect(html.json()).toMatchObject({ status: 'verified', amountEtb: 600, extraEtb: 0 });
  });

  it('reports extra money above the expected amount', async () => {
    fetchMock.mockResolvedValueOnce(htmlReceipt({ amount: '1,050.00' }));
    const res = await verify({ url: URL_OK, expectedAmountEtb: 1000 });
    expect(res.json()).toMatchObject({ status: 'verified', amountEtb: 1050, extraEtb: 50 });
  });

  it('gives each mismatch reason', async () => {
    const cases: [ReceiptOptions, string[]][] = [
      [{ amount: '599.50' }, ['AMOUNT_TOO_LOW']],
      [{ receiver: '1****9999' }, ['WRONG_RECEIVER']],
      [{ status: 'Failed' }, ['NOT_SUCCESS']],
      [{ date: new Date(Date.now() - 25 * HOUR) }, ['EXPIRED']],
    ];
    for (const [options, reasons] of cases) {
      fetchMock.mockResolvedValueOnce(htmlReceipt(options));
      const res = await verify({ url: URL_OK, expectedAmountEtb: 600 });
      expect(res.json(), JSON.stringify(options)).toMatchObject({
        status: 'not_matching',
        reasons,
      });
    }
  });

  it('answers unable_to_verify on timeout, unreachable, missing fields or other content', async () => {
    fetchMock.mockRejectedValueOnce(new ReceiptFetchError('TIMEOUT'));
    expect((await verify({ url: URL_OK, expectedAmountEtb: 600 })).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'TIMEOUT',
    });

    fetchMock.mockRejectedValueOnce(new ReceiptFetchError('UNREACHABLE'));
    expect((await verify({ url: URL_OK, expectedAmountEtb: 600 })).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'UNREACHABLE',
    });

    fetchMock.mockResolvedValueOnce(htmlReceipt({ omitReference: true }));
    expect((await verify({ url: URL_OK, expectedAmountEtb: 600 })).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'UNPARSEABLE',
    });

    fetchMock.mockResolvedValueOnce({ contentType: 'image/png', body: Buffer.from('png') });
    expect((await verify({ url: URL_OK, expectedAmountEtb: 600 })).json()).toEqual({
      status: 'unable_to_verify',
      reason: 'UNPARSEABLE',
    });
  });

  it('checks the receiver against this business only, and needs sign-in', async () => {
    const other = await createRestaurant(app);
    fetchMock.mockResolvedValueOnce(htmlReceipt());
    const res = await verify({ url: URL_OK, expectedAmountEtb: 600 }, other.owner.token);
    expect(res.json()).toMatchObject({ status: 'not_matching', reasons: ['WRONG_RECEIVER'] });

    const anon = await app.inject({
      method: 'POST',
      url: '/api/v1/verify/cbe',
      payload: { url: URL_OK, expectedAmountEtb: 600 },
    });
    expect(anon.statusCode).toBe(401);
  });

  describe('mobile banking receipt link (mbreciept.cbe.com.et)', () => {
    it('reads the bank JSON for the link and verifies it', async () => {
      fetchMock.mockResolvedValueOnce(jsonReceipt());
      const res = await verify({ url: MB_URL, expectedAmountEtb: 600 });
      expect(res.json()).toMatchObject({
        status: 'verified',
        reference: 'FT26283K4Z9P',
        amountEtb: 600,
        extraEtb: 0,
        payerName: 'KEBEDE TESFAYE ALEMU',
        receiverName: 'ABEBE COFFEE AND RESTAURANT',
      });
      const [url, options] = fetchMock.mock.calls[0] ?? [];
      expect(url?.href).toBe(
        'https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/v2-AbCdEfGhIjKlMnOpQrSt'
      );
      expect(options?.headers).toMatchObject({
        referer: 'https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt',
      });
    });

    it('refuses other paths on that host', async () => {
      for (const url of [
        'https://mbreciept.cbe.com.et/v2-abc',
        'https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt/x',
        'https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt?next=1',
        'https://mbreciept.cbe.com.et/api/v2-AbCdEfGhIjKlMnOpQrSt',
        'http://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOpQrSt',
        'https://mbreciept.cbe.com.et:8443/v2-AbCdEfGhIjKlMnOpQrSt',
      ]) {
        const res = await verify({ url, expectedAmountEtb: 600 }, r.manager.token);
        expect(res.json().error?.code, url).toBe('INVALID_URL');
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('compares the JSON fields and reports what the bank says', async () => {
      const cases: [Record<string, unknown>, unknown][] = [
        [
          { amountCredited: '550.00' },
          {
            status: 'not_matching',
            reasons: ['AMOUNT_TOO_LOW'],
            reference: 'FT26283K4Z9P',
            amountEtb: 550,
          },
        ],
        [
          { description: '2900000009999', paymentDetails: ['2900000009999'] },
          { status: 'not_matching', reasons: ['WRONG_RECEIVER'] },
        ],
        [
          { statusDesc: 'FAILED', status: 'FAILED' },
          { status: 'not_matching', reasons: ['NOT_SUCCESS'] },
        ],
        [
          { dateTimes: [new Date(Date.now() - 30 * HOUR).toISOString()] },
          { status: 'not_matching', reasons: ['EXPIRED'] },
        ],
        [{ creditAccountHolder: '' }, { status: 'unable_to_verify', reason: 'UNPARSEABLE' }],
      ];
      for (const [changes, expected] of cases) {
        fetchMock.mockResolvedValueOnce(jsonReceipt(changes));
        const res = await verify({ url: MB_URL, expectedAmountEtb: 600 }, r.waiter2.token);
        expect(res.json(), JSON.stringify(changes)).toMatchObject(expected as object);
      }

      // The bank answers 400 "transaction not found" for a link it does not know.
      fetchMock.mockRejectedValueOnce(new ReceiptFetchError('NOT_FOUND'));
      expect(
        (await verify({ url: MB_URL, expectedAmountEtb: 600 }, r.waiter2.token)).json()
      ).toEqual({
        status: 'unable_to_verify',
        reason: 'NOT_FOUND',
      });
    });
  });
});

describe('failed checks history', () => {
  async function openBill(token: string, restaurant: Restaurant = r) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      headers: headers(token, newKey()),
      payload: {
        type: 'dine',
        tableId: restaurant.tables[1]!.id,
        items: [{ menuItemId: restaurant.menu.coffee.id, quantity: 1 }],
      },
    });
    return (res.json() as { id: string }).id;
  }
  const failed = (token: string) =>
    app.inject({ method: 'GET', url: '/api/v1/verify/failed', headers: headers(token) });

  it('saves checks that do not verify, with the bill, and lists them by who may see them', async () => {
    // Earlier tests in this file also left failed checks.
    await app.prisma.receiptCheck.deleteMany({});
    const billId = await openBill(r.feeWaiter.token);

    fetchMock.mockResolvedValueOnce(jsonReceipt({ amountCredited: '550.00' }));
    await verify({ url: MB_URL, expectedAmountEtb: 600, billId }, r.feeWaiter.token);
    fetchMock.mockRejectedValueOnce(new ReceiptFetchError('TIMEOUT'));
    await verify({ url: MB_URL, expectedAmountEtb: 600 }, r.manager.token);
    // A verified check is not a failed try: it becomes the payment instead.
    fetchMock.mockResolvedValueOnce(jsonReceipt());
    await verify({ url: MB_URL, expectedAmountEtb: 600, billId }, r.feeWaiter.token);

    const all = (await failed(r.owner.token)).json() as Record<string, unknown>[];
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({
      status: 'unable_to_verify',
      reasons: ['TIMEOUT'],
      reference: null,
      receiptAmountEtb: null,
      expectedAmountEtb: 600,
      billId: null,
      label: null,
      checkedBy: 'Manager Yonas',
    });
    expect(all[1]).toMatchObject({
      status: 'not_matching',
      reasons: ['AMOUNT_TOO_LOW'],
      reference: 'FT26283K4Z9P',
      receiptAmountEtb: 550,
      expectedAmountEtb: 600,
      billId,
      label: `Table ${r.tables[1]!.number}`,
    });

    // A waiter only sees their own tries.
    const mine = (await failed(r.feeWaiter.token)).json() as { status: string }[];
    expect(mine.map((c) => c.status)).toEqual(['not_matching']);
  });

  it('refuses a bill of another business, without checking', async () => {
    const other = await createRestaurant(app);
    const res = await verify(
      { url: MB_URL, expectedAmountEtb: 600, billId: await openBill(other.owner.token, other) },
      r.feeWaiter.token
    );
    expect(res.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CBE to CBE and CBE to another bank', () => {
  // CBE to CBE receipt: the receiver is the real account holder; the reason is the sender's note.
  const cbeToCbe = {
    platformTransactionType: 'A2A',
    creditAccountHolder: 'ABEBE COFFEE',
    creditAccountNo: '1****5678',
    description: 'ball',
    paymentDetails: ['ball'],
  };

  it('CBE to CBE: needs our CBE account last 4 and the holder name', async () => {
    const cases: [Record<string, unknown>, unknown][] = [
      [cbeToCbe, { status: 'verified' }],
      // The same words in another order or with an extra name still match.
      [{ ...cbeToCbe, creditAccountHolder: 'Coffee Abebe Tesfaye' }, { status: 'verified' }],
      [
        { ...cbeToCbe, creditAccountHolder: 'Fahmi Abdi Arebo' },
        { status: 'not_matching', reasons: ['WRONG_RECEIVER_NAME'] },
      ],
      [
        { ...cbeToCbe, creditAccountNo: '1****9999' },
        { status: 'not_matching', reasons: ['WRONG_RECEIVER'] },
      ],
    ];
    for (const [changes, expected] of cases) {
      fetchMock.mockResolvedValueOnce(jsonReceipt(changes));
      const res = await verify({ url: MB_URL, expectedAmountEtb: 600 }, r.owner.token);
      expect(res.json(), JSON.stringify(changes)).toMatchObject(expected as object);
    }
  });

  it('CBE to another bank: the account in the reason must be ours, the receiver is ignored', async () => {
    const cases: [Record<string, unknown>, unknown][] = [
      // "Inter Bank" receiver alone marks a transfer to another bank.
      [
        {
          platformTransactionType: 'A2A',
          creditAccountHolder: 'Inter Bank Account To Account Paya',
        },
        { status: 'verified' },
      ],
      // Our CBE account last 4 in the receiver does not count for another-bank transfers.
      [
        { creditAccountNo: '1****5678', description: '1000123455678', paymentDetails: [] },
        { status: 'not_matching', reasons: ['WRONG_RECEIVER'] },
      ],
      [{ externalAccountNumber: '2900000000011', description: 'rent' }, { status: 'verified' }],
    ];
    for (const [changes, expected] of cases) {
      fetchMock.mockResolvedValueOnce(jsonReceipt(changes));
      const res = await verify({ url: MB_URL, expectedAmountEtb: 600 }, r.manager.token);
      expect(res.json(), JSON.stringify(changes)).toMatchObject(expected as object);
    }
  });
});

describe('CBE PDF receipt (apps.cbe.com.et:100 link)', () => {
  // Same layout as a real one: no status line, "Inter Bank" receiver, the full destination
  // account in the reason (here our Awash account).
  const otherBankPdf = {
    receiverName: 'Inter Bank Account To Account Paya',
    receiver: 'E****0950',
    reason: '2900000000011',
    omitStatus: true,
  };

  it('verifies a transfer to our account at another bank; another account does not count', async () => {
    fetchMock.mockResolvedValueOnce(pdfReceipt(otherBankPdf));
    const ok = await verify({ url: URL_OK, expectedAmountEtb: 600 }, r.waiter2.token);
    expect(ok.json()).toMatchObject({ status: 'verified', amountEtb: 600 });

    fetchMock.mockResolvedValueOnce(pdfReceipt({ ...otherBankPdf, reason: '2900000009999' }));
    const wrong = await verify({ url: URL_OK, expectedAmountEtb: 600 }, r.waiter2.token);
    expect(wrong.json()).toMatchObject({ status: 'not_matching', reasons: ['WRONG_RECEIVER'] });
  });
});
