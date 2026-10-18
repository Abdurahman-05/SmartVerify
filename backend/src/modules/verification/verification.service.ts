import { PDFParse } from 'pdf-parse';

import type { FastifyBaseLogger } from 'fastify';

import type { Env } from '../../config/env.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { cbeParser } from './banks/cbe.js';
import { BOA_NOT_FOUND, boaParser } from './banks/boa.js';
import { dashenParser } from './banks/dashen.js';
import { TELEBIRR_NOT_FOUND, telebirrParser } from './banks/telebirr.js';
import type { ReceiptParser } from './banks/types.js';
import { compareReceipt, explainComparison, type OwnAccount } from './compare.js';
import { fetchReceipt, ReceiptFetchError } from './fetch-receipt.js';
import type { FailedCheck, VerifyResponse } from './verification.schemas.js';

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
  /** Logs why a check passed or failed (no names, account last 4 only). */
  log?: Pick<FastifyBaseLogger, 'info'>,
  now = new Date(),
  /** Check against these accounts instead of the business's (subscription payments). */
  receiver?: { accounts: OwnAccount[]; name: string }
): Promise<VerifyResponse> {
  const source = parseCbeUrl(rawUrl);
  // TLS can only be relaxed outside production (CBE's certificate chain breaks some dev setups).
  const tlsStrict = env.NODE_ENV === 'production' || env.CBE_TLS_STRICT !== 'false';
  return checkReceipt({
    prisma,
    env,
    businessId,
    source,
    tlsStrict,
    parser: cbeParser,
    bank: 'CBE',
    expectedAmountEtb,
    log,
    now,
    receiver,
  });
}

/** Telebirr transaction number (10 letters/digits, e.g. DJD2QW8XTE). */
export const TELEBIRR_NUMBER = /^[A-Z0-9]{10}$/;

/** Fetches a Telebirr receipt by transaction number and checks it like a CBE one. */
export async function verifyTelebirr(
  prisma: PrismaClient,
  env: Env,
  businessId: string,
  transactionNumber: string,
  expectedAmountEtb: number,
  log?: Pick<FastifyBaseLogger, 'info'>,
  now = new Date()
): Promise<VerifyResponse> {
  if (!TELEBIRR_NUMBER.test(transactionNumber)) throw new AppError('INVALID_URL');
  return checkReceipt({
    prisma,
    env,
    businessId,
    source: {
      url: new URL(`https://transactioninfo.ethiotelecom.et/receipt/${transactionNumber}`),
    },
    tlsStrict: true,
    parser: telebirrParser,
    bank: 'Telebirr',
    expectedAmountEtb,
    log,
    now,
    // Telebirr answers 200 with this text for an unknown number.
    isNotFound: (text) => TELEBIRR_NOT_FOUND.test(text) && text.length < 2000,
    html: true,
  });
}

/** Dashen FT Ref (e.g. C65WDTI262870002). */
export const DASHEN_REFERENCE = /^[A-Z0-9]{10,24}$/;

/** Fetches a Dashen receipt by FT Ref (receipts.dashenbanksc.com/receipt/<ref>) and checks it. */
export async function verifyDashen(
  prisma: PrismaClient,
  env: Env,
  businessId: string,
  reference: string,
  expectedAmountEtb: number,
  log?: Pick<FastifyBaseLogger, 'info'>,
  now = new Date()
): Promise<VerifyResponse> {
  if (!DASHEN_REFERENCE.test(reference)) throw new AppError('INVALID_URL');
  return checkReceipt({
    prisma,
    env,
    businessId,
    // Dashen answers 400 "Transaction not found" for an unknown reference (NOT_FOUND).
    source: { url: new URL(`https://receipts.dashenbanksc.com/receipt/${reference}`) },
    tlsStrict: true,
    parser: dashenParser,
    bank: 'Dashen',
    expectedAmountEtb,
    log,
    now,
    html: true,
  });
}

/** BOA receipt id: FT reference + the sender account's last 5 digits (FT26238SRG1T10431). */
export const BOA_RECEIPT_ID = /^FT[A-Z0-9]{10}\d{5}$/;

/** Fetches a Bank of Abyssinia receipt (its JSON) by receipt id and checks it. */
export async function verifyBoa(
  prisma: PrismaClient,
  env: Env,
  businessId: string,
  receiptId: string,
  expectedAmountEtb: number,
  log?: Pick<FastifyBaseLogger, 'info'>,
  now = new Date()
): Promise<VerifyResponse> {
  if (!BOA_RECEIPT_ID.test(receiptId)) throw new AppError('INVALID_URL');
  return checkReceipt({
    prisma,
    env,
    businessId,
    source: {
      url: new URL(`https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${receiptId}`),
      headers: { accept: 'application/json', 'user-agent': 'SmartVerify/1.0' },
    },
    tlsStrict: true,
    parser: boaParser,
    bank: 'BOA',
    expectedAmountEtb,
    log,
    now,
    // BOA answers 200 with this for an unknown id.
    isNotFound: (text) => BOA_NOT_FOUND.test(text),
  });
}

/** Fetch → read → compare with the business's accounts → log why. Same for every bank. */
async function checkReceipt(input: {
  prisma: PrismaClient;
  env: Env;
  businessId: string;
  source: ReceiptSource;
  tlsStrict: boolean;
  parser: ReceiptParser;
  bank: string;
  expectedAmountEtb: number;
  log?: Pick<FastifyBaseLogger, 'info'>;
  now: Date;
  isNotFound?: (text: string) => boolean;
  /** The parser reads the HTML page itself (its table rows), not plain text. */
  html?: boolean;
  /** Check against these accounts instead of the business's (e.g. Smart Verify's own). */
  receiver?: { accounts: OwnAccount[]; name: string };
}): Promise<VerifyResponse> {
  const { prisma, env, businessId, source, tlsStrict, parser, bank, expectedAmountEtb, log, now } =
    input;

  let fetched;
  try {
    fetched = await fetchReceipt(source.url, { ...FETCH, tlsStrict, headers: source.headers });
  } catch (error) {
    const reason = error instanceof ReceiptFetchError ? error.reason : 'UNREACHABLE';
    log?.info(
      { receiptCheck: 'unable_to_verify', bank, reason },
      `${bank} check: could not fetch the receipt (${reason})`
    );
    return { status: 'unable_to_verify', reason };
  }

  const text =
    input.html && fetched.contentType.startsWith('text/html')
      ? fetched.body.toString('utf8')
      : await receiptText(fetched.contentType, fetched.body);
  if (text && input.isNotFound?.(text)) {
    log?.info(
      { receiptCheck: 'unable_to_verify', bank, reason: 'NOT_FOUND' },
      `${bank} check: no such receipt (NOT_FOUND)`
    );
    return { status: 'unable_to_verify', reason: 'NOT_FOUND' };
  }
  const receipt = text ? parser.parse(text) : null;
  if (!receipt) {
    log?.info(
      {
        receiptCheck: 'unable_to_verify',
        bank,
        reason: 'UNPARSEABLE',
        contentType: fetched.contentType,
      },
      `${bank} check: could not read the receipt (content-type ${fetched.contentType || 'none'})`
    );
    return { status: 'unable_to_verify', reason: 'UNPARSEABLE' };
  }

  // CBE accounts for CBE-to-CBE receipts; the other banks' for transfers to another bank.
  const [accounts, business] = input.receiver
    ? [input.receiver.accounts, { name: input.receiver.name }]
    : await Promise.all([
        prisma.bankAccount.findMany({
          where: { businessId, removedAt: null },
          select: { bankCode: true, accountNumber: true, last4: true, holderName: true },
        }),
        prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true } }),
      ]);
  const compareInput = {
    expectedAmountEtb,
    accounts,
    businessName: business.name,
    now,
    maxAgeHours: env.CBE_RECEIPT_MAX_AGE_HOURS,
  };
  const result = compareReceipt(receipt, compareInput);
  if (log) {
    const why = explainComparison(receipt, compareInput);
    const verdict = result.ok
      ? `VERIFIED (extra ${result.extraEtb} ETB)`
      : `NOT MATCHING (${result.reasons.join(', ')})`;
    log.info(
      {
        receiptCheck: result.ok ? 'verified' : 'not_matching',
        bank,
        ...why.fields,
        checks: why.checks,
      },
      `${bank} check ${verdict}: ${why.lines.join(' | ')}`
    );
  }
  if (!result.ok) {
    return {
      status: 'not_matching',
      reasons: result.reasons,
      reference: receipt.reference,
      amountEtb: receipt.amountEtb,
    };
  }

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

/** Saves a check that did not verify, so the failed try shows in history. */
export async function saveFailedCheck(
  prisma: PrismaClient,
  input: {
    businessId: string;
    checkedById: string;
    billId?: string;
    bankCode: string;
    expectedAmountEtb: number;
    result: Exclude<VerifyResponse, { status: 'verified' }>;
  }
) {
  const { result } = input;
  await prisma.receiptCheck.create({
    data: {
      businessId: input.businessId,
      checkedById: input.checkedById,
      billId: input.billId ?? null,
      bankCode: input.bankCode,
      expectedAmountEtb: input.expectedAmountEtb,
      status: result.status,
      reasons: result.status === 'not_matching' ? result.reasons : [result.reason],
      reference: result.status === 'not_matching' ? result.reference : null,
      receiptAmountEtb: result.status === 'not_matching' ? result.amountEtb : null,
    },
  });
}

/** Failed checks since `from`, newest first. Waiters only see their own tries. */
export async function listFailedChecks(
  prisma: PrismaClient,
  auth: { businessId: string; memberId: string; role: string },
  from: Date
) {
  const rows = await prisma.receiptCheck.findMany({
    where: {
      businessId: auth.businessId,
      createdAt: { gte: from },
      ...(auth.role === 'waiter' && { checkedById: auth.memberId }),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      checkedBy: { select: { user: { select: { name: true } } } },
      bill: {
        select: {
          type: true,
          table: { select: { number: true } },
          orders: { orderBy: { number: 'asc' }, take: 1, select: { number: true } },
        },
      },
    },
  });
  return rows.map((row): FailedCheck => {
    const bill = row.bill;
    const label = !bill
      ? null
      : bill.type === 'dine'
        ? `Table ${bill.table?.number ?? ''}`.trim()
        : `${bill.type === 'takeaway' ? 'Takeaway' : 'Delivery'} #${bill.orders[0]?.number ?? ''}`;
    return {
      id: row.id,
      billId: row.billId,
      label,
      bankCode: row.bankCode,
      status: row.status,
      // Written by saveFailedCheck from the same reason lists.
      reasons: row.reasons as FailedCheck['reasons'],
      reference: row.reference,
      receiptAmountEtb: row.receiptAmountEtb,
      expectedAmountEtb: row.expectedAmountEtb,
      checkedBy: row.checkedBy.user.name,
      createdAt: row.createdAt.toISOString(),
    };
  });
}
