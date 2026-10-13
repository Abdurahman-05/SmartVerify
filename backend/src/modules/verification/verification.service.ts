import { PDFParse } from 'pdf-parse';

import type { Env } from '../../config/env.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { cbeParser } from './banks/cbe.js';
import { compareReceipt } from './compare.js';
import { fetchReceipt, ReceiptFetchError } from './fetch-receipt.js';
import type { VerifyResponse } from './verification.schemas.js';

/** Receipt PDF/HTML link: https://apps.cbe.com.et[:100]/?id=FT… */
const CBE_HOST = 'apps.cbe.com.et';
/** The receipt link ports CBE uses ('' = 443). */
const CBE_PORTS = new Set(['', '100']);
/** FT + 10 (the reference) + 8 digits (payer account last 8). */
const CBE_ID = /^FT[A-Z0-9]{10}\d{8}$/;

/** Mobile banking receipt link: https://mbreciept.cbe.com.et/v2-<token> (CBE's spelling). */
const MB_RECEIPT_HOST = 'mbreciept.cbe.com.et';
const MB_TOKEN = /^\/(v2-[A-Za-z0-9]{10,64})$/;
/**
 * The public JSON behind that page. The headers are the ones CBE's own receipt page sends
 * (public values from its web client, not secrets); without Origin/Referer it answers "not found".
 */
const MB_DETAIL_URL = 'https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/';
const MB_HEADERS = {
  accept: 'application/json',
  'x-app-id': 'd1292e42-7400-49de-a2d3-9731caa4c819',
  'x-app-version': '0a01980b-9859-1369-8198-59f403820000',
  origin: `https://${MB_RECEIPT_HOST}`,
  // Without a User-Agent the bank answers 401; we name ourselves honestly.
  'user-agent': 'SmartVerify/1.0',
};

const FETCH = { timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024 };

interface ReceiptSource {
  url: URL;
  headers?: Record<string, string>;
}

/** Only a real CBE receipt link is fetched; anything else is INVALID_URL. */
export function parseCbeUrl(raw: string): ReceiptSource {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError('INVALID_URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new AppError('INVALID_URL');
  }

  if (url.hostname === MB_RECEIPT_HOST && url.port === '' && !url.search) {
    const token = MB_TOKEN.exec(url.pathname)?.[1];
    if (!token) throw new AppError('INVALID_URL');
    return {
      url: new URL(`${MB_DETAIL_URL}${token}`),
      headers: { ...MB_HEADERS, referer: `https://${MB_RECEIPT_HOST}/${token}` },
    };
  }

  if (
    url.hostname === CBE_HOST &&
    CBE_PORTS.has(url.port) &&
    CBE_ID.test(url.searchParams.get('id') ?? '')
  ) {
    return { url };
  }
  throw new AppError('INVALID_URL');
}

async function pdfText(data: Buffer): Promise<string | null> {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    return (await parser.getText()).text;
  } catch {
    return null;
  } finally {
    await parser.destroy();
  }
}

const entities: Record<string, string> = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function htmlText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|nbsp|lt|gt|quot|#39);/g, (e) => entities[e] ?? ' ');
}

/** Receipt text by content type; null when the type is not one we can read. */
async function receiptText(contentType: string, body: Buffer): Promise<string | null> {
  if (contentType.startsWith('application/pdf')) return pdfText(body);
  if (contentType.startsWith('text/html')) return htmlText(body.toString('utf8'));
  // Mobile banking receipts: the bank's JSON, read field by field by the parser.
  if (contentType.startsWith('application/json')) return body.toString('utf8');
  return null;
}

/** Fetches a CBE receipt and checks it against the business's accounts and the amount. */
export async function verifyCbe(
  prisma: PrismaClient,
  env: Env,
  businessId: string,
  rawUrl: string,
  expectedAmountEtb: number,
  now = new Date()
): Promise<VerifyResponse> {
  const source = parseCbeUrl(rawUrl);
  // TLS can only be relaxed outside production (CBE's certificate chain breaks some dev setups).
  const tlsStrict = env.NODE_ENV === 'production' || env.CBE_TLS_STRICT !== 'false';

  let fetched;
  try {
    fetched = await fetchReceipt(source.url, { ...FETCH, tlsStrict, headers: source.headers });
  } catch (error) {
    const reason = error instanceof ReceiptFetchError ? error.reason : 'UNREACHABLE';
    return { status: 'unable_to_verify', reason };
  }

  const text = await receiptText(fetched.contentType, fetched.body);
  const receipt = text ? cbeParser.parse(text) : null;
  if (!receipt) return { status: 'unable_to_verify', reason: 'UNPARSEABLE' };

  const accounts = await prisma.bankAccount.findMany({
    where: { businessId, bankCode: 'CBE', removedAt: null },
    select: { last4: true },
  });
  const result = compareReceipt(receipt, {
    expectedAmountEtb,
    accountLast4s: accounts.map((a) => a.last4),
    now,
    maxAgeHours: env.CBE_RECEIPT_MAX_AGE_HOURS,
  });
  if (!result.ok) return { status: 'not_matching', reasons: result.reasons };

  return {
    status: 'verified',
    reference: receipt.reference,
    amountEtb: receipt.amountEtb,
    extraEtb: result.extraEtb,
    payerName: receipt.payerName,
    receiverName: receipt.receiverName,
    date: receipt.date.toISOString(),
  };
}
