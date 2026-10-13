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
}

function receiptLines(o: ReceiptOptions = {}) {
  return [
    'Commercial Bank of Ethiopia',
    'Payer ABEBE KEBEDE',
    'Account 1****1234',
    'Receiver ABEBE COFFEE',
    `Account ${o.receiver ?? '1****5678'}`,
    `Payment Date & Time ${addisTime(o.date ?? new Date(Date.now() - HOUR))}`,
    ...(o.omitReference ? [] : ['Reference No. (VAT Invoice No) FT26283K4Z9P']),
    'Reason / Type of service Transfer',
    `Transferred Amount ${o.amount ?? '600.00'} ETB`,
    `Status ${o.status ?? 'Success'}`,
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
  await app.prisma.bankAccount.create({
    data: {
      businessId: r.businessId,
      bankCode: 'CBE',
      accountNumber: '1000123455678',
      last4: '5678',
    },
  });
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  fetchMock.mockReset();
});

const verify = (body: Record<string, unknown>, token = r.waiter.token) =>
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
      const res = await verify({ url, expectedAmountEtb: 600 });
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
      expect(res.json(), JSON.stringify(options)).toEqual({ status: 'not_matching', reasons });
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
    expect(res.json()).toEqual({ status: 'not_matching', reasons: ['WRONG_RECEIVER'] });

    const anon = await app.inject({
      method: 'POST',
      url: '/api/v1/verify/cbe',
      payload: { url: URL_OK, expectedAmountEtb: 600 },
    });
    expect(anon.statusCode).toBe(401);
  });
});
