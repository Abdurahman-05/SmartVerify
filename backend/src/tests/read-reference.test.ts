import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
    expect(found.json()).toEqual({ reference: 'FT26286JZH4B', text: USSD_TEXT });

    ocrMock.mockResolvedValueOnce('A photo of a cat');
    expect((await read(PNG.toString('base64'))).json()).toEqual({
      reference: null,
      text: 'A photo of a cat',
    });
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
