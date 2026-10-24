import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { GeminiError, readWithGemini } from '../modules/verification/gemini.js';
import { findCbeReference, isImage, readImageText } from '../modules/verification/ocr.js';
import {
  createRestaurant,
  createTestApp,
  headers,
  resetDatabase,
  type Restaurant,
  type TestApp,
} from './helpers.js';

// No real OCR in tests (it downloads language data): the text comes from here.
vi.mock('../modules/verification/ocr.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/verification/ocr.js')>();
  return { ...real, readImageText: vi.fn(), closeOcr: vi.fn() };
});
const ocrMock = vi.mocked(readImageText);
// Gemini is never called for real in tests.
vi.mock('../modules/verification/gemini.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/verification/gemini.js')>();
  return { ...real, readWithGemini: vi.fn() };
});
const geminiMock = vi.mocked(readWithGemini);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
// The USSD confirmation from a real CBE transfer, as OCR reads it.
const USSD_TEXT =
  'account number 2********1611 . on Oct\n13, 2026 12:15 PM with Transaction ID:\n' +
  'FT26286JZH4B. Remark: hs.\nTotal Amount Debited: 106.46 ETB with\nService\n#:Next';

describe('findCbeReference', () => {
  it('finds the Transaction ID in receipt text, also when OCR splits it', () => {
    expect(findCbeReference(USSD_TEXT)).toBe('FT26286JZH4B');
    expect(findCbeReference('Reference No. (VAT Invoice No) ft26286tv7sm')).toBe('FT26286TV7SM');
    expect(findCbeReference('Transaction ID: FT26286 JZH4B.')).toBe('FT26286JZH4B');
    expect(findCbeReference('Total Amount Debited: 106.46 ETB')).toBeNull();
  });

  it('accepts only PNG / JPEG / WebP pictures', () => {
    expect(isImage(PNG)).toBe(true);
    expect(isImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe(true);
    expect(isImage(Buffer.from('%PDF-1.4 not a picture'))).toBe(false);
  });
});

let app: TestApp;
let r: Restaurant;

beforeAll(async () => {
  app = await createTestApp();
  await resetDatabase(app);
  r = await createRestaurant(app);
});
afterAll(async () => {
  await app.close();
});

const read = (image: string, token: string | null = r.waiter.token) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/verify/read-reference',
    ...(token && { headers: headers(token) }),
    payload: { image },
  });

describe('POST /verify/read-reference', () => {
  it('returns the Transaction ID read from the picture, or null', async () => {
    ocrMock.mockResolvedValueOnce(USSD_TEXT);
    const found = await read(PNG.toString('base64'));
    expect(found.statusCode).toBe(200);
    expect(found.json()).toEqual({
      bank: 'CBE',
      reference: 'FT26286JZH4B',
      text: USSD_TEXT,
      source: 'ocr',
    });

    ocrMock.mockResolvedValueOnce('A photo of a cat');
    expect((await read(PNG.toString('base64'))).json()).toEqual({
      bank: 'CBE',
      reference: null,
      text: 'A photo of a cat',
      source: 'ocr',
    });
    // Without a Gemini key, Gemini is not tried.
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it('refuses something that is not a picture without reading it, and needs sign-in', async () => {
    ocrMock.mockClear();
    const res = await read(Buffer.from('%PDF-1.4 not a picture at all').toString('base64'));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(ocrMock).not.toHaveBeenCalled();

    expect((await read(PNG.toString('base64'), null)).statusCode).toBe(401);
  });
});

describe('POST /verify/read-reference with Gemini', () => {
  let gemApp: TestApp;
  let owner: string;

  beforeAll(async () => {
    gemApp = await createTestApp({ GEMINI_API_KEY: 'test-key-not-real' });
    owner = (await createRestaurant(gemApp)).owner.token;
  });
  afterAll(async () => {
    await gemApp.close();
  });

  const readGem = () =>
    gemApp.inject({
      method: 'POST',
      url: '/api/v1/verify/read-reference',
      headers: headers(owner),
      payload: { image: PNG.toString('base64') },
    });

  it('uses Gemini first; when Google is busy it retries once, then falls back to OCR', async () => {
    geminiMock.mockReset();
    ocrMock.mockReset();
    geminiMock.mockResolvedValueOnce({
      bank: 'CBE',
      reference: 'FT26279V27Y0',
      amount: 2300,
      date: '05/10/2026',
      text: 'Completed ETB2300.00 transfer',
    });
    expect((await readGem()).json()).toEqual({
      bank: 'CBE',
      reference: 'FT26279V27Y0',
      text: 'Completed ETB2300.00 transfer',
      source: 'gemini',
    });
    expect(ocrMock).not.toHaveBeenCalled();

    // Busy twice: one retry, then Tesseract.
    geminiMock.mockRejectedValueOnce(new GeminiError('http 503'));
    geminiMock.mockRejectedValueOnce(new GeminiError('http 503'));
    ocrMock.mockResolvedValueOnce(USSD_TEXT);
    expect((await readGem()).json()).toMatchObject({ reference: 'FT26286JZH4B', source: 'ocr' });
    expect(geminiMock).toHaveBeenCalledTimes(3);

    // A bad answer is not retried: straight to Tesseract.
    geminiMock.mockRejectedValueOnce(new GeminiError('bad answer'));
    ocrMock.mockResolvedValueOnce(USSD_TEXT);
    expect((await readGem()).json()).toMatchObject({ source: 'ocr' });
    expect(geminiMock).toHaveBeenCalledTimes(4);
  });

  const readAuto = (image: string) =>
    gemApp.inject({
      method: 'POST',
      url: '/api/v1/verify/read-reference',
      headers: headers(owner),
      payload: { image, bank: 'AUTO' },
    });

  it('finds the bank from the words on the receipt, then its reference', async () => {
    geminiMock.mockReset();
    geminiMock.mockRejectedValue(new GeminiError('unreachable'));
    for (const [text, bank, reference] of [
      ['Commercial Bank of Ethiopia ... Transaction ID: FT26286JZH4B', 'CBE', 'FT26286JZH4B'],
      ['telebirr ... Your transaction number is DJD2QW8XTE.', 'TEL', 'DJD2QW8XTE'],
      ['A photo of a cat', null, null],
    ] as const) {
      ocrMock.mockResolvedValueOnce(text);
      expect((await readAuto(PNG.toString('base64'))).json()).toMatchObject({ bank, reference });
    }
    geminiMock.mockReset();
  });
});
